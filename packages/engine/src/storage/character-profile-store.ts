/**
 * CharacterProfileStore
 * 统一主角与伙伴的档案存储。
 * key: "idx:N"（API 注册角色）| "name:xxx"（临时伙伴）
 * 替代旧的 CharacterMemoryStore + NpcManager._partnerRegistry
 */

import { logger } from "../core/logger";
import type { CharacterProfile } from "./save-types";

export class CharacterProfileStore {
  private readonly profiles = new Map<string, CharacterProfile>();

  clear(): void {
    this.profiles.clear();
    logger.debug("[CharacterProfileStore] cleared");
  }

  get(key: string): CharacterProfile | undefined {
    return this.profiles.get(key);
  }

  set(key: string, profile: CharacterProfile): void {
    this.profiles.set(key, profile);
  }

  getOrCreate(key: string): CharacterProfile {
    let profile = this.profiles.get(key);
    if (!profile) {
      profile = {
        player: null,
        magicContainer: { panelMagics: [], xiuLianMagic: null, bottomMagics: [], hiddenMagics: [] },
        goodsContainer: { bagItems: [], equipItems: [], bottomItems: [] },
      };
      this.profiles.set(key, profile);
    }
    return profile;
  }

  serialize(): Record<string, CharacterProfile> | undefined {
    if (this.profiles.size === 0) return undefined;
    return Object.fromEntries(this.profiles);
  }

  deserialize(data: Record<string, CharacterProfile>): void {
    this.profiles.clear();
    for (const [key, profile] of Object.entries(data)) {
      this.profiles.set(key, profile);
    }
    logger.debug(`[CharacterProfileStore] deserialized ${this.profiles.size} profiles`);
  }
}
