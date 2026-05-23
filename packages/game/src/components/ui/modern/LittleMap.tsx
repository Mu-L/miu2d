/**
 * Modern LittleMap - 小地图
 * Props 与经典 LittleMapGui 完全一致
 */

import type { Vector2 } from "@miu2d/engine/core/types";
import type { MiuMapData } from "@miu2d/engine/map/types";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { HiOutlineMap, HiOutlineXMark } from "react-icons/hi2";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, typography } from "./theme";

// 与经典 UI 一致的常量
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 240;
const _RATIO = 4;

// Character position info（与经典 UI 一致）
export interface CharacterMarker {
  x: number; // World position X
  y: number; // World position Y
  type: "player" | "enemy" | "partner" | "neutral";
}

interface LittleMapProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  mapData: MiuMapData | null;
  mapName: string;
  mapDisplayName?: string; // 地图显示名称（从 mapname.ini 获取）
  playerPosition: Vector2;
  characters: CharacterMarker[];
  cameraPosition: Vector2; // 当前相机位置
  onClose: () => void;
  onMapClick?: (worldPosition: Vector2) => void; // 点击地图移动
}

export const LittleMap: React.FC<LittleMapProps> = ({
  isVisible,
  screenWidth,
  screenHeight,
  mapData,
  mapName,
  mapDisplayName,
  playerPosition,
  characters,
  cameraPosition,
  onClose,
  onMapClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapWidth = VIEW_WIDTH;
  const mapHeight = VIEW_HEIGHT;

  // 计算地图尺寸（使用 mapPixelWidth/Height）
  const mapSize = useMemo(() => {
    if (!mapData) return { width: 0, height: 0 };
    return {
      width: mapData.mapPixelWidth,
      height: mapData.mapPixelHeight,
    };
  }, [mapData]);

  // 计算缩放比例
  const scale = useMemo(() => {
    if (mapSize.width === 0 || mapSize.height === 0) return { x: 1, y: 1 };
    return {
      x: mapWidth / mapSize.width,
      y: mapHeight / mapSize.height,
    };
  }, [mapSize]);

  // 绘制小地图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, mapWidth, mapHeight);

    // 背景
    ctx.fillStyle = "rgba(0, 20, 40, 0.8)";
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // 绘制网格
    ctx.strokeStyle = "rgba(100, 200, 255, 0.1)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < mapWidth; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapHeight);
      ctx.stroke();
    }
    for (let y = 0; y < mapHeight; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapWidth, y);
      ctx.stroke();
    }

    // 绘制角色标记（与经典 UI 一致）
    for (const char of characters) {
      const cx = char.x * scale.x;
      const cy = char.y * scale.y;

      // 根据类型设置颜色
      switch (char.type) {
        case "player":
          ctx.fillStyle = modernColors.primary;
          break;
        case "enemy":
          ctx.fillStyle = "#ff4444";
          break;
        case "partner":
          ctx.fillStyle = "#44aaff";
          break;
        case "neutral":
          ctx.fillStyle = "#44ff44";
          break;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, char.type === "player" ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();

      // 玩家额外光晕
      if (char.type === "player") {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.stroke();

        // 光晕效果
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
        gradient.addColorStop(0, "rgba(100, 200, 255, 0.4)");
        gradient.addColorStop(1, "rgba(100, 200, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 绘制视野范围
    const viewX = cameraPosition.x * scale.x;
    const viewY = cameraPosition.y * scale.y;
    // 假设视口为 screenWidth x screenHeight
    const viewW = Math.min(screenWidth, mapSize.width) * scale.x;
    const viewH = Math.min(screenHeight, mapSize.height) * scale.y;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX - viewW / 2, viewY - viewH / 2, viewW, viewH);
  }, [isVisible, characters, cameraPosition, scale, mapSize, screenWidth, screenHeight]);

  // 处理点击
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onMapClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale.x;
      const y = (e.clientY - rect.top) / scale.y;
      onMapClick({ x, y });
    },
    [onMapClick, scale]
  );

  if (!isVisible) return null;

  // 位置: 右上角
  const panelStyle: React.CSSProperties = {
    position: "absolute",
    right: 20,
    top: 20,
    width: mapWidth + 2,
    height: mapHeight + 40,
    ...glassEffect.dark,
    borderRadius: borderRadius.lg,
    pointerEvents: "auto",
    overflow: "hidden",
  };

  return (
    <div style={panelStyle}>
      {/* 标题栏 */}
      <div
        style={{
          padding: `${spacing.xs}px ${spacing.sm}px`,
          background: "rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${modernColors.border.glass}`,
        }}
      >
        <span
          style={{
            fontSize: typography.fontSize.xs,
            color: modernColors.text.secondary,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <HiOutlineMap style={iconStyle} /> {mapDisplayName || mapName || "小地图"}
        </span>
        <button
          onClick={onClose}
          type="button"
          style={{
            background: "none",
            border: "none",
            color: modernColors.text.muted,
            cursor: "pointer",
            fontSize: typography.fontSize.sm,
            padding: 0,
          }}
        >
          <HiOutlineXMark style={{ ...iconStyle, fontSize: 14 }} />
        </button>
      </div>

      {/* 坐标显示 */}
      <div
        style={{
          padding: `2px ${spacing.sm}px`,
          background: "rgba(0, 0, 0, 0.2)",
          fontSize: 10,
          color: modernColors.text.muted,
          textAlign: "center",
        }}
      >
        坐标: {Math.round(playerPosition.x)}, {Math.round(playerPosition.y)}
      </div>

      {/* 地图画布 */}
      <canvas
        ref={canvasRef}
        width={mapWidth}
        height={mapHeight}
        onClick={handleClick}
        style={{
          display: "block",
          cursor: onMapClick ? "crosshair" : "default",
        }}
      />
    </div>
  );
};
