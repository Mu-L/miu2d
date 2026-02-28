/**
 * 统一的游戏访问权限校验
 *
 * 所有需要验证用户是否有权访问游戏的地方都应使用此模块，
 * 避免在每个 service 中重复实现相同的权限校验逻辑。
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { gameMembers } from "../db/schema";
import type { Language } from "../i18n";
import { getMessage } from "../i18n";

/**
 * 验证用户是否有权访问游戏（需为游戏成员）
 */
export async function verifyGameAccess(
  gameId: string,
  userId: string,
  language: Language = "zh"
): Promise<void> {
  const [member] = await db
    .select({ id: gameMembers.id })
    .from(gameMembers)
    .where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(language, "errors.file.noAccess"),
    });
  }
}

/**
 * 验证用户是否为游戏创始人（gameMembers.role === "owner"）
 */
export async function verifyGameOwnerAccess(
  gameId: string,
  userId: string,
  language: Language = "zh"
): Promise<void> {
  const [member] = await db
    .select({ role: gameMembers.role })
    .from(gameMembers)
    .where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId)))
    .limit(1);

  if (!member || member.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(language, "errors.file.noAccess"),
    });
  }
}
