/**
 * Script Command Helpers - Shared utilities for script command implementations
 * Eliminates duplication across playerCommands/npcCommands
 */

import type { Character } from "../../character/character";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";

/**
 * Check if a character has finished moving to destination and is standing.
 *
 * @param character The character to check
 * @param destination Target tile position
 * @param reissueMove Called to re-issue movement if character stopped early
 * @param isMapObstacle Map obstacle checker
 * @param tag Log tag for warnings
 */
export function isCharacterMoveEnd(
  character: Character | null,
  destination: Vector2,
  reissueMove: (character: Character, dest: Vector2) => void,
  isMapObstacle: (x: number, y: number) => boolean,
  tag: string
): boolean {
  if (!character) return true;

  const pos = character.tilePosition;
  const atDestination = pos.x === destination.x && pos.y === destination.y;

  if (!atDestination) {
    const path = character.path;

    // 路径消耗完毕（或为空），角色站立但未到达目的地 → 放弃
    // 寻路已用最强算法 (PerfectMaxPlayerTry)，走不到就是走不到，重试无意义
    if (character.isStanding() && (!path || path.length === 0)) {
      // logger.log(`[${tag}] reached (${pos.x},${pos.y}), dest (${destination.x},${destination.y}) unreachable, giving up`);
      return true;
    }

    if (!path || path.length === 0) {
      // 路径为空但角色还在移动，等角色停下再判断
      return false;
    }

    if (
      path.length === 1 &&
      (pos.x !== path[0].x || pos.y !== path[0].y) &&
      character.hasObstacle(path[0])
    ) {
      // logger.log(`[${tag}] last step blocked by obstacle at (${path[0].x},${path[0].y}), giving up`);
      character.standingImmediately();
      return true;
    }

    if (isMapObstacle(pos.x, pos.y)) {
      // logger.warn(
      //   `[${tag}] stuck on map obstacle at (${pos.x}, ${pos.y}), giving up move to (${destination.x}, ${destination.y})`
      // );
      character.standingImmediately();
      return true;
    }

    // path valid, character still walking
    return false;
  }

  // At destination but still moving → not done yet
  if (!character.isStanding()) {
    return false;
  }
  return true;
}
