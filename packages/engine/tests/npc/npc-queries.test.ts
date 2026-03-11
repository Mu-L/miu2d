/**
 * NPC queries tests - 查询工具函数
 */
import { describe, expect, it } from "vitest";
import { findCharactersInTileDistance, findClosestCharacter } from "../../src/npc/npc-query-helpers";
import { NpcSpatialGrid } from "../../src/npc/npc-spatial-grid";

// Minimal Npc-like mock
function mockNpc(
  id: string,
  x: number,
  y: number,
  opts: { isDeathInvoked?: boolean } = {}
) {
  return {
    id,
    positionInWorld: { x, y },
    tilePosition: { x: Math.floor(x / 64), y: Math.floor(y / 32) },
    isDeathInvoked: opts.isDeathInvoked ?? false,
  } as never;
}

function mockPlayer(x: number, y: number, opts: { isDeathInvoked?: boolean } = {}) {
  return {
    positionInWorld: { x, y },
    tilePosition: { x: Math.floor(x / 64), y: Math.floor(y / 32) },
    isDeathInvoked: opts.isDeathInvoked ?? false,
  } as never;
}

type MockNpc = ReturnType<typeof mockNpc>;

function makeGrid(...npcs: MockNpc[]): NpcSpatialGrid<never> {
  const grid = new NpcSpatialGrid<never>();
  grid.rebuild(npcs as never[], (npc) => (npc as MockNpc).positionInWorld);
  return grid;
}

function makeNpcMap(...npcs: MockNpc[]): Map<string, never> {
  const map = new Map<string, never>();
  for (const npc of npcs) {
    map.set((npc as { id: string }).id, npc);
  }
  return map;
}

describe("findClosestCharacter", () => {
  it("returns null for empty NPC list", () => {
    const result = findClosestCharacter(
      makeGrid(),
      null,
      { x: 0, y: 0 },
      () => true
    );
    expect(result).toBeNull();
  });

  it("finds closest NPC", () => {
    const far = mockNpc("far", 100, 100);
    const close = mockNpc("close", 10, 10);
    const mid = mockNpc("mid", 50, 50);
    const grid = makeGrid(far, close, mid);

    const result = findClosestCharacter(grid, null, { x: 0, y: 0 }, () => true);
    expect(result).toBe(close);
  });

  it("skips dead NPCs", () => {
    const dead = mockNpc("dead", 1, 1, { isDeathInvoked: true });
    const alive = mockNpc("alive", 100, 100);
    const grid = makeGrid(dead, alive);

    const result = findClosestCharacter(grid, null, { x: 0, y: 0 }, () => true);
    expect(result).toBe(alive);
  });

  it("applies NPC filter", () => {
    const excluded = mockNpc("excluded", 1, 1);
    const included = mockNpc("included", 50, 50);
    const grid = makeGrid(excluded, included);

    const result = findClosestCharacter(
      grid,
      null,
      { x: 0, y: 0 },
      (npc) => (npc as { id: string }).id === "included"
    );
    expect(result).toBe(included);
  });

  it("includes player when playerFilter is provided and passes", () => {
    const npc1 = mockNpc("npc1", 100, 100);
    const grid = makeGrid(npc1);
    const player = mockPlayer(5, 5);

    const result = findClosestCharacter(
      grid,
      player,
      { x: 0, y: 0 },
      () => true,
      () => true
    );
    expect(result).toBe(player);
  });

  it("skips player when playerFilter not provided", () => {
    const npc1 = mockNpc("npc1", 100, 100);
    const grid = makeGrid(npc1);
    const player = mockPlayer(5, 5);

    const result = findClosestCharacter(grid, player, { x: 0, y: 0 }, () => true);
    expect(result).toBe(npc1);
  });

  it("skips characters in ignoreList", () => {
    const npc1 = mockNpc("npc1", 1, 1);
    const npc2 = mockNpc("npc2", 50, 50);
    const grid = makeGrid(npc1, npc2);

    const result = findClosestCharacter(
      grid,
      null,
      { x: 0, y: 0 },
      () => true,
      undefined,
      [npc1]
    );
    expect(result).toBe(npc2);
  });

  it("skips dead player", () => {
    const npc1 = mockNpc("npc1", 100, 100);
    const grid = makeGrid(npc1);
    const player = mockPlayer(1, 1, { isDeathInvoked: true });

    const result = findClosestCharacter(
      grid,
      player,
      { x: 0, y: 0 },
      () => true,
      () => true
    );
    expect(result).toBe(npc1);
  });
});

describe("findCharactersInTileDistance", () => {
  it("returns empty array when no matches", () => {
    const result = findCharactersInTileDistance(
      new Map(),
      null,
      { x: 0, y: 0 },
      5,
      () => true
    );
    expect(result).toEqual([]);
  });

  it("finds NPCs within tile distance", () => {
    // tilePosition = {x:0, y:0}, {x:1, y:0}, {x:10, y:10}
    const close = mockNpc("close", 30, 10);
    const mid = mockNpc("mid", 60, 10);
    const far = mockNpc("far", 640, 320);
    const npcs = makeNpcMap(close, mid, far);

    const result = findCharactersInTileDistance(
      npcs,
      null,
      { x: 0, y: 0 },
      3,
      () => true
    );

    // close and mid should be within 3 tiles; far (10,10) should not
    expect(result).toContain(close);
    expect(result).toContain(mid);
    expect(result).not.toContain(far);
  });

  it("includes player when in range and filter passes", () => {
    const npcs = makeNpcMap(mockNpc("npc1", 640, 320)); // far
    const player = mockPlayer(30, 10); // close

    const result = findCharactersInTileDistance(
      npcs,
      player,
      { x: 0, y: 0 },
      3,
      () => true,
      () => true
    );

    expect(result).toContain(player);
  });
});
