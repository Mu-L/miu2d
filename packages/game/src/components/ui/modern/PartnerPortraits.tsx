/**
 * Modern PartnerPortraits - 伙伴头像组件
 * 显示在屏幕左上角，毛玻璃风格
 */

import type React from "react";
import { useAsfImage } from "../classic/hooks";
import type { PartnerInfo } from "../classic/LittleHeadGui";
import { borderRadius, glassEffect, modernColors, typography } from "./theme";

interface PartnerPortraitsProps {
  partners: PartnerInfo[];
  onPartnerClick?: (index: number, partner: PartnerInfo) => void;
}

/** 单个伙伴头像 */
const PartnerHead: React.FC<{
  partner: PartnerInfo;
  onClick?: () => void;
}> = ({ partner, onClick }) => {
  const portraitPath = `asf/ui/littlehead/${partner.name}.asf`;
  const portrait = useAsfImage(portraitPath, 0);

  if (!portrait.dataUrl || portrait.width === 0 || portrait.height === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        width: portrait.width,
        height: portrait.height,
        cursor: partner.canEquip ? "pointer" : "default",
        userSelect: "none",
        borderRadius: borderRadius.sm,
        overflow: "hidden",
        border: `1px solid rgba(255,255,255,0.15)`,
        transition: "border-color 0.15s ease",
      }}
      onClick={partner.canEquip ? onClick : undefined}
      onMouseEnter={(e) => {
        if (partner.canEquip) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      }}
      title={partner.canEquip ? `${partner.name} - 点击打开装备` : partner.name}
    >
      <img
        src={portrait.dataUrl}
        alt={partner.name}
        width={portrait.width}
        height={portrait.height}
        style={{ display: "block", imageRendering: "pixelated" }}
        draggable={false}
      />
      {partner.canLevelUp && (
        <span
          style={{
            position: "absolute",
            right: 2,
            bottom: 1,
            color: "white",
            fontSize: "10px",
            fontFamily: "monospace",
            fontWeight: typography.fontWeight.semibold,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
          }}
        >
          LV{partner.level}
        </span>
      )}
    </div>
  );
};

/** 伙伴头像列表 - 左上角 */
export const PartnerPortraits: React.FC<PartnerPortraitsProps> = ({
  partners,
  onPartnerClick,
}) => {
  if (partners.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        top: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "auto",
        zIndex: 10,
        padding: 6,
        ...glassEffect.light,
        borderRadius: borderRadius.md,
      }}
    >
      {partners.map((partner, index) => (
        <PartnerHead
          key={partner.name}
          partner={partner}
          onClick={() => onPartnerClick?.(index, partner)}
        />
      ))}
    </div>
  );
};
