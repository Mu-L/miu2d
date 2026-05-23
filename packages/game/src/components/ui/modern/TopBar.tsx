/**
 * Modern TopBar - 顶部按钮栏
 * 位置与经典UI一致
 */
import type React from "react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineDocumentText,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { useGameUIContext } from "../../../contexts";
import { borderRadius, glassEffect, iconStyle, modernColors, spacing, transitions } from "./theme";

// Props removed — screenWidth and panel toggles are read from GameUIContext

interface TopButtonConfig {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut: string;
  onClick: () => void;
}

const TopButton: React.FC<{ config: TopButtonConfig }> = ({ config }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      title={`${config.label} (${config.shortcut})`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 28,
        background: isPressed
          ? "rgba(255, 255, 255, 0.2)"
          : isHovered
            ? "rgba(255, 255, 255, 0.1)"
            : "transparent",
        border: "none",
        borderRadius: borderRadius.sm,
        cursor: "pointer",
        transition: transitions.fast,
        color: isHovered ? modernColors.text.primary : modernColors.text.secondary,
        fontSize: 16,
        padding: 0,
      }}
      onClick={config.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      <span style={iconStyle}>{config.icon}</span>
    </button>
  );
};

export const TopBar: React.FC = () => {
  const { screenWidth, togglePanel } = useGameUIContext();
  const buttons: TopButtonConfig[] = useMemo(
    () => [
      {
        id: "state",
        label: "状态",
        icon: <HiOutlineChartBar />,
        shortcut: "F1/T",
        onClick: () => togglePanel("state"),
      },
      {
        id: "equip",
        label: "装备",
        icon: <HiOutlineShieldCheck />,
        shortcut: "F2/E",
        onClick: () => togglePanel("equip"),
      },
      {
        id: "xiulian",
        label: "修炼",
        icon: <HiOutlineAcademicCap />,
        shortcut: "F3",
        onClick: () => togglePanel("xiulian"),
      },
      {
        id: "goods",
        label: "物品",
        icon: <HiOutlineShoppingBag />,
        shortcut: "F5/I",
        onClick: () => togglePanel("goods"),
      },
      {
        id: "magic",
        label: "武功",
        icon: <HiOutlineSparkles />,
        shortcut: "F6/M",
        onClick: () => togglePanel("magic"),
      },
      { id: "memo", label: "任务", icon: <HiOutlineDocumentText />, shortcut: "F7", onClick: () => togglePanel("memo") },
      {
        id: "system",
        label: "系统",
        icon: <HiOutlineCog6Tooth />,
        shortcut: "ESC",
        onClick: () => togglePanel("system"),
      },
    ],
    [togglePanel]
  );

  const panelWidth = 300;

  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      top: 0,
      width: panelWidth,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      ...glassEffect.standard,
      borderRadius: `0 0 ${borderRadius.lg}px ${borderRadius.lg}px`,
      borderTop: "none",
      pointerEvents: "auto",
      zIndex: 1000,
    }),
    [screenWidth]
  );

  return (
    <div style={panelStyle}>
      {buttons.map((btn) => (
        <TopButton key={btn.id} config={btn} />
      ))}
    </div>
  );
};
