/**
 * MobileSkillButtons - 移动端技能按钮组件
 *
 * 类似王者荣耀的技能按钮布局
 * 右侧区域：攻击按钮、技能按钮、跳跃按钮等
 */

import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import {
  HiOutlineArrowUp,
  HiOutlineBars3,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineMap,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
} from "react-icons/hi2";

export interface SkillButtonConfig {
  /** 唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon?: ReactNode;
  /** 按钮颜色 */
  color?: string;
  /** 按钮大小 */
  size?: "small" | "medium" | "large";
  /** 是否禁用 */
  disabled?: boolean;
  /** 冷却时间（毫秒） */
  cooldown?: number;
}

export interface MobileSkillButtonsProps {
  /** 攻击按钮回调 */
  onAttack?: () => void;
  /** 跳跃按钮回调 */
  onJump?: () => void;
  /** 交互按钮回调（与NPC/物体交互） */
  onInteract?: () => void;
  /** 打开背包 */
  onOpenInventory?: () => void;
  /** 打开小地图 */
  onOpenMinimap?: () => void;
  /** 打开系统菜单 */
  onOpenMenu?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

interface SkillButtonProps {
  label: string;
  icon?: ReactNode;
  color?: string;
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  onPress: () => void;
}

/**
 * 单个技能按钮
 */
function SkillButton({
  label,
  icon,
  color = "rgba(255,100,100,0.8)",
  size = "medium",
  disabled = false,
  onPress,
}: SkillButtonProps) {
  const touchIdRef = useRef<number | null>(null);

  const sizeMap = {
    small: 50,
    medium: 65,
    large: 80,
  };

  const buttonSize = sizeMap[size];

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 如果当前按钮已经在处理触摸，忽略新触摸
      if (disabled || touchIdRef.current !== null) return;

      // 获取按下这个按钮的触摸点（可能不是第一个触摸点）
      const touch = e.changedTouches[0];
      if (!touch) return;

      e.preventDefault();
      touchIdRef.current = touch.identifier;
      onPress();
    },
    [disabled, onPress]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
    if (touch) {
      touchIdRef.current = null;
    }
  }, []);

  return (
    <div
      className="relative select-none touch-none flex items-center justify-center"
      style={{
        width: buttonSize,
        height: buttonSize,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* 按钮背景 */}
      <div
        className="absolute inset-0 rounded-full border-2 border-white/40"
        style={{
          background: disabled
            ? "rgba(100,100,100,0.5)"
            : `radial-gradient(circle at 30% 30%, ${color}, rgba(0,0,0,0.6))`,
          boxShadow: disabled
            ? "none"
            : `0 4px 12px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.3)`,
          opacity: disabled ? 0.5 : 1,
        }}
      />

      {/* 图标或文字 */}
      <div
        className="relative z-10 text-white font-bold text-center"
        style={{
          fontSize: icon ? buttonSize * 0.4 : buttonSize * 0.25,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        {icon || label}
      </div>
    </div>
  );
}

/**
 * 小型快捷按钮（用于菜单、背包等）
 */
function QuickButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const touchIdRef = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 如果当前按钮已经在处理触摸，忽略新触摸
      if (disabled || touchIdRef.current !== null) return;

      // 获取按下这个按钮的触摸点（可能不是第一个触摸点）
      const touch = e.changedTouches[0];
      if (!touch) return;

      e.preventDefault();
      touchIdRef.current = touch.identifier;
      onPress();
    },
    [disabled, onPress]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
    if (touch) {
      touchIdRef.current = null;
    }
  }, []);

  return (
    <div
      className="relative select-none touch-none flex items-center justify-center"
      style={{ width: 40, height: 40 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      title={label}
    >
      <div
        className="absolute inset-0 rounded-lg bg-black/40 border border-white/20"
        style={{
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        }}
      />
      <span className="relative z-10 text-lg">{icon}</span>
    </div>
  );
}

/**
 * 移动端技能按钮组件
 */
export function MobileSkillButtons({
  onAttack,
  onJump,
  onInteract,
  onOpenInventory,
  onOpenMinimap,
  onOpenMenu,
  disabled = false,
}: MobileSkillButtonsProps) {
  return (
    <div className="flex flex-col items-end gap-3">
      {/* 顶部快捷按钮 */}
      <div className="flex gap-2 mb-2">
        <QuickButton
          label="地图"
          icon={<HiOutlineMap className="text-white" style={{ strokeWidth: 2.2 }} />}
          onPress={onOpenMinimap ?? (() => {})}
          disabled={disabled || !onOpenMinimap}
        />
        <QuickButton
          label="背包"
          icon={<HiOutlineShoppingBag className="text-white" style={{ strokeWidth: 2.2 }} />}
          onPress={onOpenInventory ?? (() => {})}
          disabled={disabled || !onOpenInventory}
        />
        <QuickButton
          label="菜单"
          icon={<HiOutlineBars3 className="text-white" style={{ strokeWidth: 2.2 }} />}
          onPress={onOpenMenu ?? (() => {})}
          disabled={disabled || !onOpenMenu}
        />
      </div>

      {/* 主技能按钮区域（类似王者荣耀布局） */}
      <div className="relative" style={{ width: 180, height: 150 }}>
        {/* 攻击按钮（右下角，最大） */}
        <div className="absolute" style={{ right: 0, bottom: 0 }}>
          <SkillButton
            label="攻击"
            icon={<HiOutlineShieldCheck className="text-white" style={{ strokeWidth: 2.2 }} />}
            color="rgba(255,80,80,0.8)"
            size="large"
            disabled={disabled}
            onPress={onAttack ?? (() => {})}
          />
        </div>

        {/* 跳跃按钮（攻击按钮左上方） */}
        <div className="absolute" style={{ right: 85, bottom: 50 }}>
          <SkillButton
            label="跳"
            icon={<HiOutlineArrowUp className="text-white" style={{ strokeWidth: 2.2 }} />}
            color="rgba(100,180,255,0.8)"
            size="medium"
            disabled={disabled}
            onPress={onJump ?? (() => {})}
          />
        </div>

        {/* 交互按钮（攻击按钮上方） */}
        <div className="absolute" style={{ right: 10, bottom: 90 }}>
          <SkillButton
            label="互动"
            icon={<HiOutlineChatBubbleBottomCenterText className="text-white" style={{ strokeWidth: 2.2 }} />}
            color="rgba(100,255,150,0.8)"
            size="small"
            disabled={disabled}
            onPress={onInteract ?? (() => {})}
          />
        </div>
      </div>
    </div>
  );
}

export default MobileSkillButtons;
