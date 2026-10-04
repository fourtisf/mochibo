/**
 * EXAMPLE CONTENT (preview).
 * Example agents and illustrative UI values. They are labelled as examples on the page and
 * never presented as real usage. Phase 3 reads real agents and stats from the API
 * (/discover, /leaderboard, /stats) and deletes this file.
 */
import { EXAMPLE_AGENTS, type SkillCategory, type SkillId } from "@orbis/shared";

export interface MarketAgent {
  id: string;
  name: string;
  by: string;
  char: string;
  cat: SkillCategory;
  desc: string;
  skills: SkillId[];
  price: number;
  runs: number;
  rating: number;
}

/** Discover cards: the example agents from @orbis/shared (priced by the API), with card-only fields. */
export const MARKET: readonly MarketAgent[] = EXAMPLE_AGENTS.map((a) => ({ ...a, runs: 0, rating: 0 }));

/** Hero floating task card rotation. */
export const HERO_TASKS: readonly (readonly [string, string])[] = [
  ["is researching", "Comparing 4 sources"],
  ["is writing a thread", "Draft 2 of 3"],
  ["is translating", "English to Spanish"],
  ["is planning a launch", "Step 3 of 5"],
  ["is reading a whitepaper", "Page 12 of 30"],
];

/** Bento "Earn on every run" tile (an illustrative example week). */
export const BENTO_EARN = { total: 2591, series: [12, 18, 15, 26, 22, 34, 30, 41, 38, 52, 48, 63, 70, 84] } as const;
