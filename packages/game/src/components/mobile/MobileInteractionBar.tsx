/**
 * MobileInteractionBar - 移动端交互条组件
 *
 * 当玩家靠近可交互的 NPC 或物品时，显示简洁的半透明交互条
 * 点击后触发与 PC 端点击相同的交互效果
 *
 * UI 设计参考原神：半透明长条，左侧显示物件的 ASF 精灵图标
 */

import { CharacterKind } from "@miu2d/engine/core/types";
import type { Npc } from "@miu2d/engine/npc";
import { type Obj, ObjState } from "@miu2d/engine/obj/obj";
import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import { getViewTileDistance } from "@miu2d/engine/utils";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineArchiveBox, HiOutlineUser } from "react-icons/hi2";
import { AsfAnimatedSprite } from "../ui/classic/AsfAnimatedSprite";

/** 可交互目标类型 */
export type InteractableTarget =
  | { type: "npc"; target: Npc; name: string; distance: number; asfPath: string | null }
  | { type: "obj"; target: Obj; name: string; distance: number; asfPath: string | null };

export interface MobileInteractionBarProps {
  /** 游戏引擎实例 */
  engine: GameEngine | null;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大交互距离（格子数） */
  maxDistance?: number;
}

/** 检测范围（格子数） */
const DETECTION_DISTANCE = 3;
/** 更新间隔（毫秒） */
const UPDATE_INTERVAL = 100;
/** 精灵图标显示大小 */
const SPRITE_SIZE = 28;

/**
 * 获取 NPC 的 ASF 路径
 */
function getNpcAsfPath(npc: Npc): string | null {
  const basePath = npc.basePath;
  const baseFileName = npc.baseFileName;
  if (!basePath || !baseFileName) return null;
  return `${basePath}/${baseFileName}stand.asf`;
}

/**
 * 获取 Obj 的 ASF 路径
 */
function getObjAsfPath(obj: Obj): string | null {
  const commonRes = obj.objFile.get(ObjState.Common);
  if (commonRes?.imagePath) {
    return `/asf/object/${commonRes.imagePath}`;
  }
  return null;
}

/**
 * 移动端交互条组件
 */
export const MobileInteractionBar = memo(function MobileInteractionBar({
  engine,
  disabled = false,
  maxDistance = DETECTION_DISTANCE,
}: MobileInteractionBarProps) {
  // 附近可交互目标
  const [nearbyTargets, setNearbyTargets] = useState<InteractableTarget[]>([]);
  // 是否正在交互中
  const [isInteracting, setIsInteracting] = useState(false);
  // 用于防止重复点击
  const interactingRef = useRef(false);

  /**
   * 检测附近的可交互目标
   */
  const detectNearbyTargets = useCallback(() => {
    if (!engine || disabled) {
      setNearbyTargets([]);
      return;
    }

    const gameManager = engine.getGameManager();
    if (!gameManager) {
      setNearbyTargets([]);
      return;
    }

    // 检查是否有阻塞性 UI 打开（对话框、选择框等）
    const guiManager = gameManager.guiManager;
    if (
      guiManager.isDialogVisible() ||
      guiManager.isSelectionVisible() ||
      !guiManager.isMultiSelectionEnd()
    ) {
      setNearbyTargets([]);
      return;
    }

    // 检查脚本是否正在运行
    const scriptExecutor = gameManager.scriptExecutor;
    if (scriptExecutor.isRunning()) {
      setNearbyTargets([]);
      return;
    }

    const player = gameManager.player;
    if (!player) {
      setNearbyTargets([]);
      return;
    }

    const playerTile = player.tilePosition;
    const targets: InteractableTarget[] = [];

    // 检测附近的 NPC
    const npcManager = gameManager.npcManager;
    for (const [, npc] of npcManager.getAllNpcs()) {
      // 只检测可见的、可交互的 Eventer NPC
      if (!npc.isVisible || npc.isDeath) continue;
      if (npc.kind !== CharacterKind.Eventer) continue;
      if (!npc.isInteractive) continue;
      // 排除敌对NPC（敌对NPC应该用攻击而非交互）
      if (npc.isEnemy) continue;

      const dist = getViewTileDistance(playerTile, npc.tilePosition);
      if (dist <= maxDistance) {
        targets.push({
          type: "npc",
          target: npc,
          name: npc.name || "NPC",
          distance: dist,
          asfPath: getNpcAsfPath(npc),
        });
      }
    }

    // 检测附近的物品
    const objManager = gameManager.objManager;
    for (const obj of objManager.getAllObjs()) {
      // 只检测可显示的、有交互脚本的物品
      if (!obj.isShow || obj.isRemoved) continue;
      if (!obj.hasInteractScript) continue;

      const dist = getViewTileDistance(playerTile, obj.tilePosition);
      if (dist <= maxDistance) {
        targets.push({
          type: "obj",
          target: obj,
          name: obj.objName || "物品",
          distance: dist,
          asfPath: getObjAsfPath(obj),
        });
      }
    }

    // 按距离排序，最近的在前
    targets.sort((a, b) => a.distance - b.distance);

    // 只保留最近的一个目标（简洁设计）
    setNearbyTargets(targets.slice(0, 1));
  }, [engine, disabled, maxDistance]);

  // 定期检测附近目标
  useEffect(() => {
    if (!engine || disabled) return;

    // 立即检测一次
    detectNearbyTargets();

    // 定期更新
    const interval = setInterval(detectNearbyTargets, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [engine, disabled, detectNearbyTargets]);

  /**
   * 处理交互点击
   */
  const handleInteract = useCallback(
    async (target: InteractableTarget) => {
      if (!engine || disabled || interactingRef.current) return;

      interactingRef.current = true;
      setIsInteracting(true);

      try {
        const gameManager = engine.getGameManager();
        if (!gameManager) return;

        if (target.type === "npc") {
          // 与 NPC 交互
          await gameManager.interactWithNpc(target.target);
        } else {
          // 与物品交互
          await gameManager.interactWithObj(target.target);
        }
      } finally {
        interactingRef.current = false;
        setIsInteracting(false);
      }
    },
    [engine, disabled]
  );

  // 没有目标时不渲染
  if (nearbyTargets.length === 0) {
    return null;
  }

  const target = nearbyTargets[0];

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        bottom: 130,
        right: 220,
        zIndex: 110,
      }}
    >
      <InteractionButton
        target={target}
        onClick={() => handleInteract(target)}
        disabled={isInteracting || disabled}
      />
    </div>
  );
});

/**
 * 交互按钮组件 - 简洁半透明长条设计
 */
const InteractionButton = memo(function InteractionButton({
  target,
  onClick,
  disabled,
}: {
  target: InteractableTarget;
  onClick: () => void;
  disabled: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  // 触摸事件处理
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled || touchIdRef.current !== null) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      e.preventDefault();
      e.stopPropagation();
      touchIdRef.current = touch.identifier;
      setIsPressed(true);
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (touch) {
        touchIdRef.current = null;
        setIsPressed(false);
        onClick();
      }
    };

    const handleGlobalTouchCancel = () => {
      if (touchIdRef.current !== null) {
        touchIdRef.current = null;
        setIsPressed(false);
      }
    };

    button.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchCancel);

    return () => {
      button.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchCancel);
    };
  }, [disabled, onClick]);

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md
        transition-all duration-100 select-none
        bg-black/30
        ${isPressed ? "scale-95 bg-white/10" : "scale-100"}
        ${disabled ? "opacity-50" : "opacity-100"}
      `}
      style={{
        minWidth: 120,
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
    >
      {/* 精灵图标 */}
      <div
        className="flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
        }}
      >
        {target.asfPath ? (
          <AsfAnimatedSprite
            path={target.asfPath}
            autoPlay={true}
            loop={true}
            style={{
              maxWidth: SPRITE_SIZE,
              maxHeight: SPRITE_SIZE,
              objectFit: "contain",
            }}
          />
        ) : target.type === "npc" ? (
          <HiOutlineUser className="text-white/60 text-xl" style={{ strokeWidth: 2.2 }} />
        ) : (
          <HiOutlineArchiveBox className="text-white/60 text-xl" style={{ strokeWidth: 2.2 }} />
        )}
      </div>

      {/* 名称 */}
      <span className="text-white text-sm font-medium truncate flex-1 text-left">
        {target.name}
      </span>

      {/* 交互提示 */}
      <span className="text-white/50 text-xs flex-shrink-0">
        点击{target.type === "npc" ? "对话" : "交互"}
      </span>
    </button>
  );
});

export default MobileInteractionBar;
