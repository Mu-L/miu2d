/**
 * FogOfWarMap - 战争迷雾风格地图 HUD
 *
 * - 固定显示在屏幕左上角，无交互
 * - 绿色轮廓显示障碍物（只画边缘）
 * - 根据玩家坐标逐步揭示地图（迷雾效果）
 * - 玩家=青色圆点，NPC=黄色，敌人=红色
 * - 每张地图的探索进度保存在内存中
 * - Tab 键切换显示/隐藏
 */

import type { Vector2 } from "@miu2d/engine/core/types";
import { BarrierType, type MiuMapData } from "@miu2d/engine/map/types";
import { pixelToTile } from "@miu2d/engine/utils/coordinate";
import type React from "react";
import { useEffect, useRef } from "react";

import type { CharacterMarker } from "./LittleMapGui";

// ============= 迷雾探索数据结构 =============

/** 每张地图的探索数据 */
interface MapExplorationData {
  /** 地图列数 */
  columns: number;
  /** 地图行数 */
  rows: number;
  /** 已揭示的 tile 位图：1 = 已揭示，0 = 未揭示 */
  revealed: Uint8Array;
}

/** 全局探索进度存储，key = mapName */
const explorationStore = new Map<string, MapExplorationData>();

/** 获取或创建地图探索数据 */
function getExplorationData(mapName: string, columns: number, rows: number): MapExplorationData {
  const existing = explorationStore.get(mapName);
  if (existing && existing.columns === columns && existing.rows === rows) {
    return existing;
  }
  const data: MapExplorationData = {
    columns,
    rows,
    revealed: new Uint8Array(columns * rows),
  };
  explorationStore.set(mapName, data);
  return data;
}

/** 揭示整张地图（全图探索，调试用） */
export function revealFullMap(mapName: string, columns: number, rows: number): void {
  const data: MapExplorationData = {
    columns,
    rows,
    revealed: new Uint8Array(columns * rows).fill(1),
  };
  explorationStore.set(mapName, data);
}

/** 以玩家 tile 位置为中心揭示周围区域（圆形） */
function revealAroundPlayer(
  data: MapExplorationData,
  playerTileX: number,
  playerTileY: number,
  radius: number,
): void {
  const { columns, rows, revealed } = data;
  const minCol = Math.max(0, playerTileX - radius);
  const maxCol = Math.min(columns - 1, playerTileX + radius);
  const minRow = Math.max(0, playerTileY - radius);
  const maxRow = Math.min(rows - 1, playerTileY + radius);
  const r2 = radius * radius;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const dx = col - playerTileX;
      const dy = row - playerTileY;
      if (dx * dx + dy * dy <= r2) {
        revealed[col + row * columns] = 1;
      }
    }
  }
}

/** 检查障碍 tile 是否在轮廓边缘（与非障碍/未揭示 tile 相邻） */
function isEdgeObstacle(
  barriers: Uint8Array,
  revealed: Uint8Array,
  col: number,
  row: number,
  columns: number,
  rows: number,
): boolean {
  const neighbors = [
    [col - 1, row],
    [col + 1, row],
    [col, row - 1],
    [col, row + 1],
  ] as const;

  for (const [nc, nr] of neighbors) {
    if (nc < 0 || nc >= columns || nr < 0 || nr >= rows) return true;
    const nIdx = nc + nr * columns;
    if (revealed[nIdx] !== 1) return true;
    const nb = barriers[nIdx];
    if (nb === BarrierType.None || nb === BarrierType.CanOver) return true;
  }
  return false;
}

// ============= 渲染常量 =============

/** 玩家周围揭示半径（tile 数） */
const REVEAL_RADIUS = 15;

// 45° 旋转投影：先去交错 (u,v)，再旋转 45°，将地形菱形轮廓变成正方形外观：
//   u = col + (row&1)*0.5       → 世界 x（消除行偏移）
//   v = row / 2                  → 世界 y（每 2 行 = 1 单位）
//   map_x = (u - v + V_MAX)      → 旋转后 x，range: 0..U_MAX+V_MAX
//   map_y = (u + v)              → 旋转后 y，range: 0..U_MAX+V_MAX
// canvas 为正方形，side = U_MAX + V_MAX ≈ mapCols + mapRows/2
const CELL_PX = 1; // canvas 渲染像素/世界单位
const HUD_MAX_SIZE = 462; // HUD 最大显示尺寸（CSS px）

/** HUD 距屏幕左上角的偏移 */
const HUD_LEFT = 0;
const HUD_TOP = 0;

// ============= 组件 =============

interface FogOfWarMapProps {
  mapData: MiuMapData | null;
  mapName: string;
  playerPosition: Vector2;
  characters: CharacterMarker[];
}

export const FogOfWarMap: React.FC<FogOfWarMapProps> = ({
  mapData,
  mapName,
  playerPosition,
  characters,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mapColumns = mapData?.mapColumnCounts ?? 0;
  const mapRows = mapData?.mapRowCounts ?? 0;

  // V_MAX = 世界高度（行数/2），用于将 map_x 平移到正值范围
  const vMax = mapRows / 2;
  // canvas 正方形边长 = U_MAX + V_MAX ≈ mapCols + mapRows/2
  const canvasSide = Math.ceil(mapColumns + 0.5 + vMax) || 1;
  // HUD 显示尺寸（CSS px），不超过 HUD_MAX_SIZE
  const displaySize = Math.min(HUD_MAX_SIZE, canvasSide);

  // 玩家 tile 坐标
  const playerTile = pixelToTile(playerPosition.x, playerPosition.y);
  const playerTileX = playerTile.x;
  const playerTileY = playerTile.y;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || mapColumns === 0 || mapRows === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const exploration = getExplorationData(mapName, mapColumns, mapRows);
    revealAroundPlayer(exploration, playerTileX, playerTileY, REVEAL_RADIUS);

    const { barriers } = mapData;
    const { revealed } = exploration;

    ctx.clearRect(0, 0, canvasSide, canvasSide);

    // 45° 旋转投影公式（原地 inline，避免重复计算 vMax）：
    // u = col + (row&1)*0.5,  v = row/2
    // dx = round((u - v + vMax) * CELL_PX)
    // dy = round((u + v) * CELL_PX)

    // 人物点大小：目标约 4 CSS px；障碍边框固定 1 canvas px（保持细线）
    const dSize = Math.min(HUD_MAX_SIZE, canvasSide);
    const dotSize = Math.max(2, Math.round(3 * canvasSide / dSize));

    // 障碍轮廓（绿色，1×1 canvas px 保持细腻）
    ctx.fillStyle = "#00ff00";
    for (let row = 0; row < mapRows; row++) {
      for (let col = 0; col < mapColumns; col++) {
        const idx = col + row * mapColumns;
        if (revealed[idx] !== 1) continue;
        const b = barriers[idx];
        if (
          b === BarrierType.Obstacle ||
          b === BarrierType.CanOverObstacle ||
          b === BarrierType.Trans ||
          b === BarrierType.CanOverTrans
        ) {
          if (isEdgeObstacle(barriers, revealed, col, row, mapColumns, mapRows)) {
            const u = col + (row & 1) * 0.5;
            const v = row / 2;
            const dx = Math.round((u - v + vMax) * CELL_PX);
            const dy = Math.round((u + v) * CELL_PX);
            ctx.fillRect(dx, dy, 1, 1);
          }
        }
      }
    }

    // NPC / 敌人
    for (const char of characters) {
      const charTile = pixelToTile(char.x, char.y);
      const tileX = charTile.x;
      const tileY = charTile.y;
      if (tileX < 0 || tileX >= mapColumns || tileY < 0 || tileY >= mapRows) continue;
      if (revealed[tileX + tileY * mapColumns] !== 1) continue;

      switch (char.type) {
        case "enemy":
          ctx.fillStyle = "#ff2222";
          break;
        case "partner":
          ctx.fillStyle = "#00ffff";
          break;
        default:
          ctx.fillStyle = "#ffff00";
          break;
      }
      const nu = tileX + (tileY & 1) * 0.5;
      const nv = tileY / 2;
      ctx.fillRect(
        Math.round((nu - nv + vMax) * CELL_PX),
        Math.round((nu + nv) * CELL_PX),
        dotSize,
        dotSize,
      );
    }

    // 玩家（青色方块）
    ctx.fillStyle = "#00ffff";
    const pu = playerTileX + (playerTileY & 1) * 0.5;
    const pv = playerTileY / 2;
    ctx.fillRect(
      Math.round((pu - pv + vMax) * CELL_PX),
      Math.round((pu + pv) * CELL_PX),
      dotSize,
      dotSize,
    );
  }, [mapData, mapName, mapColumns, mapRows, canvasSide, vMax, playerTileX, playerTileY, characters]);

  if (!mapData || mapColumns === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasSide}
      height={canvasSide}
      style={{
        position: "absolute",
        left: HUD_LEFT,
        top: HUD_TOP,
        width: displaySize,
        height: displaySize,
        imageRendering: "pixelated",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    />
  );
};

