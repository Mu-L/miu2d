/**
 * useTouchDropHandlers - 触摸拖放处理器（Classic / Modern 共享）
 *
 * 将 ClassicGameUI 和 ModernGameUIWrapper 中完全相同的 5 个 touch drop
 * useCallback handler 提取到此 hook，消除重复代码。
 */

import { MAGIC_LIST_CONFIG } from "@miu2d/engine/player/magic/magic-list-config";
import { GoodKind } from "@miu2d/engine/player/goods";
import { useCallback } from "react";
import type { TouchDragData } from "../../contexts";
import type { EquipSlotType } from "../ui/classic";
import { slotTypeToEquipPosition } from "../ui/classic";
import { equipSlotToUISlot } from "./useGameUILogic";
import type { GameUILogic } from "./useGameUILogic";

export function useTouchDropHandlers(logic: Pick<GameUILogic, "dispatch" | "engine">) {
  const { dispatch, engine } = logic;

  const handleBottomTouchDrop = useCallback(
    (targetIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "goods") {
        if (targetIndex < 3 && touchData.bagIndex !== undefined) {
          if (touchData.goodsInfo?.kind !== GoodKind.Drug) {
            dispatch({ type: "SHOW_MESSAGE", text: "只有药品可以放到快捷栏" });
            return;
          }
          dispatch({ type: "MOVE_BAG_TO_BOTTOM", bagIndex: touchData.bagIndex, bottomSlot: targetIndex });
        } else if (targetIndex < 3 && touchData.bottomSlot !== undefined) {
          dispatch({ type: "SWAP_BOTTOM_GOODS", fromSlot: touchData.bottomSlot, toSlot: targetIndex });
        }
      } else if (touchData.type === "magic") {
        if (targetIndex >= 3) {
          const targetBottomSlot = targetIndex - 3;
          if (touchData.storeIndex !== undefined) {
            dispatch({
              type: "ASSIGN_MAGIC_TO_BOTTOM",
              magicIndex: touchData.storeIndex,
              bottomSlot: targetBottomSlot,
            });
          } else if (touchData.bottomSlot !== undefined) {
            dispatch({
              type: "SWAP_BOTTOM_SLOTS",
              fromSlot: touchData.bottomSlot - 3,
              toSlot: targetBottomSlot,
            });
          }
        }
      }
    },
    [dispatch]
  );

  const handleEquipTouchDrop = useCallback(
    (slot: EquipSlotType, touchData: TouchDragData) => {
      if (touchData.type === "goods" && touchData.bagIndex !== undefined) {
        dispatch({
          type: "EQUIP_ITEM",
          fromIndex: touchData.bagIndex,
          toSlot: equipSlotToUISlot(slot),
        });
      } else if (touchData.type === "equip" && touchData.equipSlot) {
        dispatch({
          type: "SWAP_EQUIP_SLOTS",
          fromSlot: equipSlotToUISlot(touchData.equipSlot as EquipSlotType),
          toSlot: equipSlotToUISlot(slot),
        });
      }
    },
    [dispatch]
  );

  const handleGoodsTouchDrop = useCallback(
    (targetIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "goods" && touchData.bagIndex !== undefined) {
        dispatch({ type: "SWAP_ITEMS", fromIndex: touchData.bagIndex, toIndex: targetIndex });
      } else if (touchData.type === "goods" && touchData.bottomSlot !== undefined) {
        dispatch({ type: "MOVE_BOTTOM_TO_BAG", bottomSlot: touchData.bottomSlot, bagIndex: targetIndex });
      } else if (touchData.type === "equip" && touchData.equipSlot) {
        const fromIndex = slotTypeToEquipPosition(touchData.equipSlot as EquipSlotType) + 500;
        dispatch({ type: "SWAP_ITEMS", fromIndex, toIndex: targetIndex });
      }
    },
    [dispatch]
  );

  const handleMagicTouchDrop = useCallback(
    (targetStoreIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "magic" && touchData.storeIndex !== undefined) {
        dispatch({
          type: "SWAP_MAGIC",
          fromIndex: touchData.storeIndex,
          toIndex: targetStoreIndex,
        });
      } else if (touchData.type === "magic" && touchData.bottomSlot !== undefined) {
        // 从快捷栏拖回技能栏：清除快捷栏引用
        dispatch({ type: "CLEAR_BOTTOM_SLOT", bottomSlot: touchData.bottomSlot - 3 });
      }
    },
    [dispatch]
  );

  const handleXiuLianTouchDrop = useCallback(
    (touchData: TouchDragData) => {
      const xiuLianIndex = MAGIC_LIST_CONFIG.xiuLianIndex;
      if (touchData.type === "magic") {
        if (
          touchData.storeIndex !== undefined &&
          touchData.storeIndex > 0 &&
          touchData.storeIndex !== xiuLianIndex
        ) {
          dispatch({ type: "SWAP_MAGIC", fromIndex: touchData.storeIndex, toIndex: xiuLianIndex });
        } else if (touchData.bottomSlot !== undefined) {
          // 从快捷栏拖到修炼区：直接互换
          dispatch({ type: "SET_XIULIAN_FROM_BOTTOM", bottomSlot: touchData.bottomSlot - 3 });
        }
      }
    },
    [dispatch]
  );

  return {
    handleBottomTouchDrop,
    handleEquipTouchDrop,
    handleGoodsTouchDrop,
    handleMagicTouchDrop,
    handleXiuLianTouchDrop,
  };
}
