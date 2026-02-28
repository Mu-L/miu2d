/**
 * 文件公开访问路由（Hono）
 *
 * 提供 /game/:gameSlug/resources/* 路径的公开访问
 * 用于游戏客户端直接加载资源文件
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "../db/client";
import { files, games } from "../db/schema";
import * as s3 from "../storage/s3";
import { Logger } from "../utils/logger";

const logger = new Logger("FileRoutes");

export const fileRoutes = new Hono();

/**
 * 公开访问游戏资源文件
 *
 * GET /game/:gameSlug/resources/*resourcePath
 * 例如: /game/william-chan/resources/测试/1.txt
 */
fileRoutes.get(":gameSlug/resources/*", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    // 从 URL 中提取完整路径（去除 /:gameSlug/resources/ 前缀）
    const fullPath = new URL(c.req.url).pathname;
    const prefix = `/game/${gameSlug}/resources/`;
    const filePath = decodeURIComponent(fullPath.substring(prefix.length));

    if (!filePath) {
      return c.json({ error: "File path is required" }, 400);
    }

    logger.debug(`[getResource] gameSlug=${gameSlug}, filePath=${filePath}`);

    // 1. 根据 slug 获取游戏
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    // 2. 解析路径，找到目标文件
    const pathSegments = filePath.split("/").filter(Boolean);
    const file = await resolveFilePath(game.id, pathSegments);

    if (!file) {
      return c.json({ error: "File not found" }, 404);
    }

    if (file.type !== "file" || !file.storageKey) {
      return c.json({ error: "Path is not a file" }, 400);
    }

    // 3. 从 S3 获取文件流（流式传输，不加载到内存），支持 ETag 条件请求
    const ifNoneMatch = c.req.header("if-none-match");
    const {
      stream: fileStream,
      contentType,
      contentLength,
      etag,
      notModified,
    } = await s3.getFileStream(file.storageKey, ifNoneMatch);

    // 304 Not Modified — 文件内容未变化，不需要重新传输
    if (notModified) {
      c.header("Cache-Control", "no-cache");
      c.header("Access-Control-Allow-Origin", "*");
      if (etag) c.header("ETag", etag);
      return c.body(null, 304);
    }

    // 4. 设置响应头
    c.header("Content-Type", file.mimeType || contentType || "application/octet-stream");
    if (contentLength !== undefined) {
      c.header("Content-Length", String(contentLength));
    }
    // no-cache: 允许缓存，但每次必须向服务器验证 (ETag)，文件未变时返回 304
    c.header("Cache-Control", "no-cache");
    c.header("Access-Control-Allow-Origin", "*");
    if (etag) c.header("ETag", etag);

    // 5. 流式传输文件内容
    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error("[getResource] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 根据路径段解析文件（大小写不敏感）
 *
 * 对每个路径段做一次 DB 查询，避免递归 CTE 的 LIMIT/DISTINCT 限制。
 * 路径通常只有 2-6 段，N 次小查询开销可忽略不计。
 */
async function resolveFilePath(
  gameId: string,
  pathSegments: string[]
): Promise<typeof files.$inferSelect | null> {
  if (pathSegments.length === 0) return null;

  let parentId: string | null = null;

  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i];
    const isLast = i === pathSegments.length - 1;
    const segLower = seg.toLowerCase();

    let matchedRow: typeof files.$inferSelect | undefined;

    if (parentId === null) {
      const rows = await db
        .select()
        .from(files)
        .where(and(
          eq(files.gameId, gameId),
          isNull(files.parentId),
          sql`LOWER(${files.name}) = ${segLower}`,
          isNull(files.deletedAt),
        ))
        .limit(1);
      matchedRow = rows[0];
    } else {
      const rows = await db
        .select()
        .from(files)
        .where(and(
          eq(files.gameId, gameId),
          eq(files.parentId, parentId),
          sql`LOWER(${files.name}) = ${segLower}`,
          isNull(files.deletedAt),
        ))
        .limit(1);
      matchedRow = rows[0];
    }

    if (!matchedRow) return null;
    if (isLast) return matchedRow;
    parentId = matchedRow.id;
  }

  return null;
}
