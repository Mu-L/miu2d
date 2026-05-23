/**
 * MobileActionButtons - 移动端技能和物品按钮组件
 *
 * 类似王者荣耀的技能按钮布局：
 * - 5个技能按钮（A/S/D/F/G）：扇形排列，显示技能ASF图标
 * - 3个物品按钮（Z/X/C）：横排，显示物品图标
 * - 1个菜单按钮
 *
 * 技能释放机制：
 * - 需要方向的技能：按下开始瞄准，滑动调整方向，松开释放
 * - 不需要方向的技能（如清心咒）：按下即释放，无瞄准指示器
 */

import type { MagicItemInfo } from "@miu2d/engine/magic/types";
import { magicNeedsDirectionPointer } from "@miu2d/engine/magic/types";
import type { GoodsItemInfo } from "@miu2d/engine/player/goods/goods-list-manager";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineBars3 } from "react-icons/hi2";
import { AsfAnimatedSprite } from "../ui/classic/AsfAnimatedSprite";
import { useAsfImage } from "../ui/classic/hooks";

/** 瞄准状态 */
export interface TargetingState {
  /** 是否正在瞄准 */
  active: boolean;
  /** 技能槽位索引 */
  slotIndex: number;
  /** 瞄准方向（相对于按钮中心的偏移，归一化后可用于计算世界坐标偏移） */
  direction: { x: number; y: number };
  /** 按钮在屏幕上的位置（用于计算滑动偏移） */
  buttonCenter: { x: number; y: number };
}

export interface MobileActionButtonsProps {
  /** 技能释放回调（松开时触发） */
  onMagicRelease: (slotIndex: number, direction: { x: number; y: number }) => void;
  /** 技能瞄准开始回调 */
  onTargetingStart?: (slotIndex: number) => void;
  /** 技能瞄准更新回调（滑动时） */
  onTargetingUpdate?: (slotIndex: number, direction: { x: number; y: number }) => void;
  /** 技能瞄准结束回调（松开时） */
  onTargetingEnd?: (slotIndex: number) => void;
  /** 使用物品回调（slotIndex: 0-2 对应 Z/X/C） */
  onUseItem: (slotIndex: number) => void;
  /** 打开菜单回调 */
  onOpenMenu?: () => void;
  /** 跑步状态变化回调（按下时开始跑，松开时停止跑） */
  onRunStateChange?: (isRunning: boolean) => void;
  /** 底栏武功数据 */
  bottomMagics?: (MagicItemInfo | null)[];
  /** 底栏物品数据 */
  bottomGoods?: (GoodsItemInfo | null)[];
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 技能按钮组件 - 支持瞄准和松开释放
 * 使用全局 touch 事件监听，支持多点触控
 *
 * 根据技能类型决定行为：
 * - 需要方向的技能：按下开始瞄准，滑动调整方向，松开释放
 * - 不需要方向的技能：按下即释放，无瞄准过程
 */
const MagicButton = memo(function MagicButton({
  shortcut,
  slotIndex,
  size = 40,
  magicInfo,
  needsTargeting = true,
  disabled = false,
  onPressStart,
  onPressMove,
  onPressEnd,
  onInstantRelease,
}: {
  shortcut: string;
  slotIndex: number;
  size?: number;
  magicInfo?: MagicItemInfo | null;
  /** 是否需要瞄准（不需要的技能按下即释放） */
  needsTargeting?: boolean;
  disabled?: boolean;
  onPressStart: (slotIndex: number, buttonCenter: { x: number; y: number }) => void;
  onPressMove: (slotIndex: number, direction: { x: number; y: number }) => void;
  onPressEnd: (slotIndex: number, direction: { x: number; y: number }) => void;
  /** 不需要瞄准的技能按下时直接调用 */
  onInstantRelease?: (slotIndex: number) => void;
}) {
  const touchIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDirectionRef = useRef<{ x: number; y: number }>({ x: 0, y: -1 });
  const [isPressed, setIsPressed] = useState(false);
  // 使用 ref 存储回调，避免 effect 重复注册
  const callbacksRef = useRef({
    onPressMove,
    onPressEnd,
    onInstantRelease,
    slotIndex,
    needsTargeting,
  });
  callbacksRef.current = { onPressMove, onPressEnd, onInstantRelease, slotIndex, needsTargeting };

  const iconPath = magicInfo?.magic?.icon || null;
  const hasSkill = !!magicInfo?.magic;

  const getButtonCenter = useCallback(() => {
    if (!buttonRef.current) return { x: 0, y: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  // 存储回调到 ref，避免闭包问题
  const onPressStartRef = useRef(onPressStart);
  onPressStartRef.current = onPressStart;
  const slotIndexRef = useRef(slotIndex);
  slotIndexRef.current = slotIndex;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const needsTargetingRef = useRef(needsTargeting);
  needsTargetingRef.current = needsTargeting;

  // 全局触摸事件监听，确保多点触控时不会丢失事件
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      // 如果当前按钮已经在处理触摸，忽略新触摸
      if (disabledRef.current || touchIdRef.current !== null) return;

      // 获取按下这个按钮的触摸点（可能不是第一个触摸点）
      const touch = e.changedTouches[0];
      if (!touch) return;

      e.preventDefault();
      e.stopPropagation();
      setIsPressed(true);

      // 如果不需要瞄准，按下时直接释放技能
      if (!needsTargetingRef.current) {
        // 直接释放技能，不进入瞄准模式
        if (callbacksRef.current.onInstantRelease) {
          callbacksRef.current.onInstantRelease(callbacksRef.current.slotIndex);
        }
        // 短暂延迟后恢复按钮状态
        setTimeout(() => setIsPressed(false), 100);
        return;
      }

      // 需要瞄准的技能，进入瞄准模式
      touchIdRef.current = touch.identifier;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastDirectionRef.current = { x: 0, y: -1 }; // 默认朝上

      // 通知开始瞄准
      const center = getButtonCenter();
      onPressStartRef.current(slotIndexRef.current, center);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null || !touchStartRef.current) return;

      const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current);
      if (!touch) return;

      // 计算滑动方向（相对于按下位置）
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      // 如果滑动距离足够，更新方向
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        const direction = { x: dx / distance, y: dy / distance };
        lastDirectionRef.current = direction;
        callbacksRef.current.onPressMove(callbacksRef.current.slotIndex, direction);
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (touch) {
        const direction = lastDirectionRef.current;
        touchIdRef.current = null;
        touchStartRef.current = null;
        setIsPressed(false);

        // 松开时释放技能
        callbacksRef.current.onPressEnd(callbacksRef.current.slotIndex, direction);
      }
    };

    button.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchEnd);

    return () => {
      button.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);
    };
  }, [getButtonCenter]);

  return (
    <div
      ref={buttonRef}
      className="relative select-none touch-none flex items-center justify-center"
      style={{
        width: size,
        height: size,
        transform: isPressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 0.1s ease-out",
      }}
    >
      {/* 按钮边框（无背景） */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: hasSkill
            ? "1.5px solid rgba(255,255,255,0.5)"
            : "1.5px solid rgba(255,255,255,0.2)",
          background: isPressed ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.3)",
          boxShadow: isPressed ? "inset 0 2px 4px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.3)",
          opacity: disabled ? 0.4 : 1,
          transition: "all 0.15s ease-out",
        }}
      />

      {/* 技能图标 */}
      {iconPath && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full"
          style={{ padding: 4 }}
        >
          <AsfAnimatedSprite
            path={iconPath}
            autoPlay={true}
            loop={true}
            style={{
              maxWidth: size - 8,
              maxHeight: size - 8,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* 快捷键标识 */}
      <div
        className="absolute bg-black/70 rounded px-1 text-[9px] text-white/80 font-mono"
        style={{
          bottom: -2,
          right: -2,
        }}
      >
        {shortcut}
      </div>

      {/* 按下效果遮罩 */}
      {isPressed && (
        <div
          className="absolute inset-0 rounded-full bg-white/20"
          style={{ pointerEvents: "none" }}
        />
      )}
    </div>
  );
});

/**
 * 物品按钮组件 - 松开时触发
 * 使用全局 touch 事件监听，支持多点触控
 * 显示物品图标和数量
 */
const ItemButton = memo(function ItemButton({
  shortcut,
  slotIndex,
  size = 36,
  goodsInfo,
  disabled = false,
  onPress,
}: {
  shortcut: string;
  slotIndex: number;
  size?: number;
  goodsInfo?: GoodsItemInfo | null;
  disabled?: boolean;
  onPress: () => void;
}) {
  const touchIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // 获取物品图标
  const iconPath = goodsInfo?.good?.iconPath ?? goodsInfo?.good?.imagePath ?? null;
  const itemIcon = useAsfImage(iconPath, 0);
  const hasItem = !!goodsInfo?.good;
  const count = goodsInfo?.count ?? 0;

  // 全局监听 touchend，确保多点触控时不会丢失事件
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      // 如果当前按钮已经在处理触摸，忽略新触摸
      if (disabledRef.current || touchIdRef.current !== null) return;

      // 获取按下这个按钮的触摸点（可能不是第一个触摸点）
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
        // 松开时使用物品
        onPressRef.current();
      }
    };

    button.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchEnd);

    return () => {
      button.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);
    };
  }, []);

  return (
    <div
      ref={buttonRef}
      className="relative select-none touch-none flex items-center justify-center"
      style={{
        width: size,
        height: size,
        transform: isPressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 0.1s ease-out",
      }}
    >
      {/* 按钮边框 */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          border: hasItem
            ? "1.5px solid rgba(200,180,100,0.7)"
            : "1.5px solid rgba(200,180,100,0.3)",
          background: isPressed ? "rgba(200,180,100,0.2)" : "rgba(0,0,0,0.3)",
          boxShadow: isPressed ? "inset 0 2px 4px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.3)",
          opacity: disabled ? 0.4 : 1,
        }}
      />

      {/* 物品图标 */}
      {hasItem && itemIcon.dataUrl && (
        <img
          src={itemIcon.dataUrl}
          alt={goodsInfo?.good?.name ?? "物品"}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: size - 8,
            maxHeight: size - 8,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 没有物品时显示快捷键 */}
      {!hasItem && (
        <div
          className="relative z-10 text-white/60 font-mono font-bold"
          style={{ fontSize: size * 0.35 }}
        >
          {shortcut}
        </div>
      )}

      {/* 快捷键标识（有物品时显示在右下角） */}
      {hasItem && (
        <div
          className="absolute bg-black/70 rounded px-0.5 text-[8px] text-white/70 font-mono"
          style={{
            bottom: -1,
            right: -1,
          }}
        >
          {shortcut}
        </div>
      )}

      {/* 物品数量（左上角） */}
      {hasItem && count > 1 && (
        <span
          style={{
            position: "absolute",
            left: 2,
            top: 1,
            fontSize: 9,
            color: "rgba(167, 157, 255, 0.9)",
            textShadow: "0 1px 2px #000",
            pointerEvents: "none",
          }}
        >
          {count}
        </span>
      )}

      {/* 按下效果遮罩 */}
      {isPressed && (
        <div
          className="absolute inset-0 rounded-lg bg-white/20"
          style={{ pointerEvents: "none" }}
        />
      )}
    </div>
  );
});

/**
 * 菜单按钮组件
 * 使用全局 touch 事件监听，支持多点触控
 */
const _MenuButton = memo(function MenuButton({
  size = 32,
  disabled = false,
  onPress,
}: {
  size?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const touchIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // 全局监听 touchend
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      // 如果当前按钮已经在处理触摸，忽略新触摸
      if (disabledRef.current || touchIdRef.current !== null) return;

      // 获取按下这个按钮的触摸点
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
        onPressRef.current();
      }
    };

    button.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchEnd);

    return () => {
      button.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);
    };
  }, []);

  return (
    <div
      ref={buttonRef}
      className="relative select-none touch-none flex items-center justify-center"
      style={{
        width: size,
        height: size,
        transform: isPressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 0.1s ease-out",
      }}
    >
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          border: "1.5px solid rgba(255,255,255,0.3)",
          background: isPressed ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.4)",
          opacity: disabled ? 0.4 : 1,
        }}
      />
      <HiOutlineBars3 className="relative z-10 text-white/70 text-lg" style={{ strokeWidth: 2.2 }} />
    </div>
  );
});

/**
 * 跑步按钮组件 - 按住时跑步
 * 使用全局 touch 事件监听，支持多点触控
 */
const RunButton = memo(function RunButton({
  size = 48,
  disabled = false,
  onRunStateChange,
}: {
  size?: number;
  disabled?: boolean;
  onRunStateChange?: (isRunning: boolean) => void;
}) {
  const touchIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const onRunStateChangeRef = useRef(onRunStateChange);
  onRunStateChangeRef.current = onRunStateChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // 全局监听 touch 事件
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || touchIdRef.current !== null) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      e.preventDefault();
      e.stopPropagation();
      touchIdRef.current = touch.identifier;
      setIsPressed(true);
      // 按下时开始跑步
      onRunStateChangeRef.current?.(true);
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (touch) {
        touchIdRef.current = null;
        setIsPressed(false);
        // 松开时停止跑步
        onRunStateChangeRef.current?.(false);
      }
    };

    button.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchEnd);

    return () => {
      button.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);
    };
  }, []);

  return (
    <div
      ref={buttonRef}
      className="relative select-none touch-none flex items-center justify-center"
      style={{
        width: size,
        height: size,
        transform: isPressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 0.1s ease-out",
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: isPressed ? "2px solid rgba(255,200,100,0.8)" : "2px solid rgba(255,255,255,0.4)",
          background: isPressed ? "rgba(255,200,100,0.3)" : "rgba(0,0,0,0.4)",
          boxShadow: isPressed
            ? "0 0 12px rgba(255,200,100,0.5), inset 0 0 8px rgba(255,200,100,0.2)"
            : "0 2px 4px rgba(0,0,0,0.3)",
          opacity: disabled ? 0.4 : 1,
        }}
      />
      <span
        className="relative z-10"
        style={{
          fontSize: size * 0.5,
          filter: isPressed ? "brightness(1.2)" : "none",
        }}
      >
        🏃
      </span>
    </div>
  );
});

/**
 * 移动端技能和物品按钮组件
 */
export function MobileActionButtons({
  onMagicRelease,
  onTargetingStart,
  onTargetingUpdate,
  onTargetingEnd,
  onUseItem,
  onOpenMenu,
  onRunStateChange,
  bottomMagics,
  bottomGoods,
  disabled = false,
}: MobileActionButtonsProps) {
  // 技能快捷键
  const magicShortcuts = ["A", "S", "D", "F", "G"];
  // 物品快捷键
  const itemShortcuts = ["Z", "X", "C"];

  // 技能按下开始（需要瞄准的技能）
  const handleMagicPressStart = useCallback(
    (slotIndex: number, _buttonCenter: { x: number; y: number }) => {
      onTargetingStart?.(slotIndex);
    },
    [onTargetingStart]
  );

  // 技能滑动中
  const handleMagicPressMove = useCallback(
    (slotIndex: number, direction: { x: number; y: number }) => {
      onTargetingUpdate?.(slotIndex, direction);
    },
    [onTargetingUpdate]
  );

  // 技能松开释放（需要瞄准的技能）
  const handleMagicPressEnd = useCallback(
    (slotIndex: number, direction: { x: number; y: number }) => {
      onTargetingEnd?.(slotIndex);
      onMagicRelease(slotIndex, direction);
    },
    [onMagicRelease, onTargetingEnd]
  );

  // 不需要瞄准的技能按下即释放
  const handleInstantRelease = useCallback(
    (slotIndex: number) => {
      // 直接释放技能，使用默认方向（朝上）
      onMagicRelease(slotIndex, { x: 0, y: -1 });
    },
    [onMagicRelease]
  );

  return (
    <div className="flex flex-col items-end gap-2">
      {/* 物品按钮区域（3个横排） */}
      <div className="flex gap-2 mb-2">
        {itemShortcuts.map((shortcut, index) => (
          <ItemButton
            key={`item-${index}-${bottomGoods?.[index]?.good?.name ?? "empty"}`}
            shortcut={shortcut}
            slotIndex={index}
            size={42}
            goodsInfo={bottomGoods?.[index]}
            disabled={disabled}
            onPress={() => onUseItem(index)}
          />
        ))}
      </div>

      {/* 技能按钮区域（5个圆环排列） */}
      <div className="relative" style={{ width: 180, height: 190 }}>
        {/* 圆环中心 - 跑步按钮 */}
        <div className="absolute" style={{ left: 66, top: 76 }}>
          <RunButton size={48} disabled={disabled} onRunStateChange={onRunStateChange} />
        </div>

        {/* 技能1 (A) - 右下 */}
        <div className="absolute" style={{ left: 108, top: 118 }}>
          <MagicButton
            key={`magic-0-${bottomMagics?.[0]?.magic?.name ?? "empty"}`}
            shortcut={magicShortcuts[0]}
            slotIndex={0}
            size={48}
            magicInfo={bottomMagics?.[0]}
            needsTargeting={magicNeedsDirectionPointer(bottomMagics?.[0]?.magic)}
            disabled={disabled}
            onPressStart={handleMagicPressStart}
            onPressMove={handleMagicPressMove}
            onPressEnd={handleMagicPressEnd}
            onInstantRelease={handleInstantRelease}
          />
        </div>

        {/* 技能2 (S) - 左下 */}
        <div className="absolute" style={{ left: 39, top: 130 }}>
          <MagicButton
            key={`magic-1-${bottomMagics?.[1]?.magic?.name ?? "empty"}`}
            shortcut={magicShortcuts[1]}
            slotIndex={1}
            size={48}
            magicInfo={bottomMagics?.[1]}
            needsTargeting={magicNeedsDirectionPointer(bottomMagics?.[1]?.magic)}
            disabled={disabled}
            onPressStart={handleMagicPressStart}
            onPressMove={handleMagicPressMove}
            onPressEnd={handleMagicPressEnd}
            onInstantRelease={handleInstantRelease}
          />
        </div>

        {/* 技能3 (D) - 左 */}
        <div className="absolute" style={{ left: 7, top: 67 }}>
          <MagicButton
            key={`magic-2-${bottomMagics?.[2]?.magic?.name ?? "empty"}`}
            shortcut={magicShortcuts[2]}
            slotIndex={2}
            size={48}
            magicInfo={bottomMagics?.[2]}
            needsTargeting={magicNeedsDirectionPointer(bottomMagics?.[2]?.magic)}
            disabled={disabled}
            onPressStart={handleMagicPressStart}
            onPressMove={handleMagicPressMove}
            onPressEnd={handleMagicPressEnd}
            onInstantRelease={handleInstantRelease}
          />
        </div>

        {/* 技能4 (F) - 左上 */}
        <div className="absolute" style={{ left: 57, top: 17 }}>
          <MagicButton
            key={`magic-3-${bottomMagics?.[3]?.magic?.name ?? "empty"}`}
            shortcut={magicShortcuts[3]}
            slotIndex={3}
            size={48}
            magicInfo={bottomMagics?.[3]}
            needsTargeting={magicNeedsDirectionPointer(bottomMagics?.[3]?.magic)}
            disabled={disabled}
            onPressStart={handleMagicPressStart}
            onPressMove={handleMagicPressMove}
            onPressEnd={handleMagicPressEnd}
            onInstantRelease={handleInstantRelease}
          />
        </div>

        {/* 技能5 (G) - 右上 */}
        <div className="absolute" style={{ left: 120, top: 49 }}>
          <MagicButton
            key={`magic-4-${bottomMagics?.[4]?.magic?.name ?? "empty"}`}
            shortcut={magicShortcuts[4]}
            slotIndex={4}
            size={48}
            magicInfo={bottomMagics?.[4]}
            needsTargeting={magicNeedsDirectionPointer(bottomMagics?.[4]?.magic)}
            disabled={disabled}
            onPressStart={handleMagicPressStart}
            onPressMove={handleMagicPressMove}
            onPressEnd={handleMagicPressEnd}
            onInstantRelease={handleInstantRelease}
          />
        </div>
      </div>
    </div>
  );
}

export default MobileActionButtons;
