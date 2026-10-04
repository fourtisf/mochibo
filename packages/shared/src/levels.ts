/*
 * Agent levels and rare items. An agent earns XP when other wallets run it (at most 1 XP per
 * wallet per agent per day, so nobody can farm it alone) and when it wins a battle. Levels unlock
 * rare items for its look. The API enforces the locks; the studio shows them.
 */
import type { CharacterConfig } from "./characters";
import { TOKEN_SYMBOL, type TierId } from "./config";

/** XP needed for each level: index 0 is level 1. */
export const LEVEL_XP = [0, 5, 15, 40, 100, 250] as const;
export const MAX_LEVEL = LEVEL_XP.length;

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP where this level started. */
  floor: number;
  /** XP needed for the next level, or null at the top level. */
  next: number | null;
}

export function levelFor(xp: number): LevelInfo {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return { level, xp, floor: LEVEL_XP[level - 1], next: level < MAX_LEVEL ? LEVEL_XP[level] : null };
}

export interface RareItem {
  id: string;
  name: string;
  field: "hat" | "back";
  value: CharacterConfig["hat"] | CharacterConfig["back"];
  /** Level that unlocks it. */
  level?: number;
  /** Only for token holders (Holder tier or higher). */
  holder?: boolean;
}

export const RARE_ITEMS: readonly RareItem[] = [
  { id: "aura", name: "Sparkle aura", field: "back", value: "aura", level: 2 },
  { id: "goldwings", name: "Gold wings", field: "back", value: "goldwings", level: 3 },
  { id: "crown", name: "Crown", field: "hat", value: "crown", level: 4 },
  { id: "galaxy", name: "Galaxy ring", field: "back", value: "galaxy", level: 5 },
  { id: "diamond", name: "Diamond halo", field: "hat", value: "diamond", holder: true },
];

/** Battle wins give this much XP. */
export const XP_PER_BATTLE_WIN = 3;

export const isUnlocked = (item: RareItem, level: number, tier: TierId) => (item.holder ? tier !== "FREE" : level >= (item.level ?? 1));

/** The first rare item in a look that this agent cannot use yet, or null. */
export function lockedItem(cfg: Pick<CharacterConfig, "hat" | "back">, level: number, tier: TierId): RareItem | null {
  for (const item of RARE_ITEMS) if (cfg[item.field] === item.value && !isUnlocked(item, level, tier)) return item;
  return null;
}

/** "Reach level 3 to use Gold wings." */
export const lockMessage = (item: RareItem) => (item.holder ? `${item.name} is for $${TOKEN_SYMBOL} holders.` : `Reach level ${item.level} to use ${item.name}.`);

/** Rare items that unlock when an agent goes from one level to a higher one. */
export const unlockedBetween = (from: number, to: number) => RARE_ITEMS.filter((i) => i.level !== undefined && i.level > from && i.level <= to);
