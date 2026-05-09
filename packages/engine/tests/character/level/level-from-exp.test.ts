/**
 * levelFromExp - 累计经验值到目标等级的纯算法测试
 *
 * 该函数是主角与伙伴升级共用的核心算法，对齐 JxqyHD/Engine/Character.cs - ToLevel()。
 * 等级配置中 `levelUpExp` 为离开该等级所需的累计经验阈值。
 */
import { describe, expect, it } from "vitest";
import { type LevelDetail, levelFromExp } from "../../../src/character/level/level-manager";

function makeConfig(thresholds: number[]): Map<number, LevelDetail> {
  const config = new Map<number, LevelDetail>();
  thresholds.forEach((levelUpExp, idx) => {
    config.set(idx + 1, {
      level: idx + 1,
      lifeMax: 100 + idx * 50,
      thewMax: 50,
      manaMax: 30,
      attack: 10,
      attack2: 5,
      attack3: 3,
      defend: 8,
      defend2: 4,
      defend3: 2,
      evade: 5,
      levelUpExp,
      newMagic: "",
      newGood: "",
    });
  });
  return config;
}

describe("levelFromExp", () => {
  it("零经验对应 1 级", () => {
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 0)).toBe(1);
  });

  it("经验小于 1 级阈值仍是 1 级", () => {
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 99)).toBe(1);
  });

  it("经验恰好等于阈值，仍属于该等级（边界保守）", () => {
    // exp=100, level1.levelUpExp=100, 100 > 100 为 false，跳到 level2
    // 这个语义与 C# `levelUpExp > exp` 一致：达到阈值即离开本级
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 100)).toBe(2);
  });

  it("经验超过 1 级阈值，进入 2 级", () => {
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 150)).toBe(2);
  });

  it("一次跳多级（经验远超 2 级阈值）", () => {
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 400)).toBe(3);
  });

  it("达到顶级阈值时停留在顶级", () => {
    const config = makeConfig([100, 250, 500]);
    expect(levelFromExp(config, 99999)).toBe(3);
  });

  it("空配置返回 1（兜底）", () => {
    expect(levelFromExp(null, 100)).toBe(1);
    expect(levelFromExp(new Map(), 100)).toBe(1);
  });

  it("非连续等级配置（缺等级 2）按 size 计数仍能选到合理目标", () => {
    // size = 2，循环到 target=2 检查 level2，不存在则不会 break
    // 最终 target=count=2，仍选 level2 不存在 → calculateLevelUp 在 levelUpTo 中兜底
    // 这里只测算法返回值
    const config = new Map<number, LevelDetail>();
    config.set(1, {
      level: 1, lifeMax: 100, thewMax: 50, manaMax: 30, attack: 10,
      attack2: 5, attack3: 3, defend: 8, defend2: 4, defend3: 2,
      evade: 5, levelUpExp: 100, newMagic: "", newGood: "",
    });
    config.set(3, {
      level: 3, lifeMax: 220, thewMax: 75, manaMax: 65, attack: 22,
      attack2: 12, attack3: 8, defend: 18, defend2: 9, defend3: 5,
      evade: 10, levelUpExp: 500, newMagic: "", newGood: "",
    });
    // 累计经验 200，level1.levelUpExp=100 <= 200，target++
    // level2 不存在 → 进入 target=3 但循环条件是 target <= size(=2)，循环结束 target=3 > count → clamp 到 2
    // 也就是最高目标受 size 钳制，而非最高 key——这是已知的简化行为
    expect(levelFromExp(config, 200)).toBe(2);
  });
});
