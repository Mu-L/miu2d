/**
 * Game hooks exports
 */

export type {
  BottomMagicDragData,
  BuyData,
  GameUILogic,
  GoodsData,
  MagicData,
  MagicDragData,
  MagicTooltipState,
  MinimapState,
  TooltipState,
} from "./useGameUILogic";
export { equipSlotToUISlot, useGameUILogic } from "./useGameUILogic";
export { buildGameUIContextValue } from "./buildGameUIContextValue";
export { useTouchDropHandlers } from "./useTouchDropHandlers";
