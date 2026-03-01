/**
 * buildGameUIContextValue - 构建 GameUIContext 所需数据（Classic / Modern 共享）
 *
 * 将 ClassicGameUI 和 ModernGameUIWrapper 中完全相同的 gameUIContextValue
 * 构建逻辑提取到此函数，消除重复代码。
 *
 * 纯函数，无 React Hook，可在组件渲染阶段直接调用。
 */

import type { GameUIContextValue } from "../../contexts";
import type { GoodItemData } from "../ui/classic";
import type { GameUILogic } from "./useGameUILogic";

export function buildGameUIContextValue(
  logic: GameUILogic,
  width: number,
  height: number,
): GameUIContextValue {
  const {
    togglePanel,
    player,
    handleMagicHover,
    handleMagicLeave,
    handleMouseLeave,
    setTooltip,
  } = logic;

  return {
    screenWidth: width,
    screenHeight: height,
    togglePanel,
    playerVitals: {
      life: player?.life ?? 100,
      lifeMax: player?.lifeMax ?? 100,
      mana: player?.mana ?? 50,
      manaMax: player?.manaMax ?? 50,
      thew: player?.thew ?? 100,
      thewMax: player?.thewMax ?? 100,
    },
    onMagicHover: handleMagicHover,
    onMagicLeave: handleMagicLeave,
    onGoodsHover: (goodData: GoodItemData | null, x: number, y: number) => {
      if (goodData?.good) {
        setTooltip({
          isVisible: true,
          good: goodData.good,
          isRecycle: false,
          position: { x, y },
        });
      }
    },
    onGoodsLeave: handleMouseLeave,
  };
}
