/**
 * magic-list-config.ts - 武功列表共享常量
 *
 * 放在 magic/ 模块中以消除 magic ↔ player 循环依赖：
 * passive-manager.ts 从此处导入（magic → magic，无循环）。
 */

/** 武功列表索引常量 */
export const MAGIC_LIST_CONFIG = {
  maxMagic: 60, // 武功面板最大槽位（1-60）
  storeIndexBegin: 1, // 存储区起始索引（向后兼容 ui-bridge.ts）
  storeIndexEnd: 60, // 存储区结束索引（向后兼容 ui-bridge.ts）
  bottomSlotCount: 5, // 快捷栏槽位数
  xiuLianIndex: 61, // 修炼武功虚拟索引（向后兼容 ui-bridge.ts / engine-ui-bridge-factory.ts）
};
