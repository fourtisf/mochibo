/**
 * PLACEHOLDER DATA (phase 1 only).
 * Everything in this file is hardcoded preview content copied from the prototype.
 * Delete it in phase 3 and read the same shapes from the API (/discover, /leaderboard, /stats).
 */
import type { SkillCategory, SkillId } from "@orbis/shared";

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

export const MARKET: readonly MarketAgent[] = [
  { id: "m1", name: "Deal Desk", by: "@mika", char: "mika", cat: "Research", desc: "Turns a token or stock ticker into a one-page brief with the main risks.", skills: ["research", "summary"], price: 15, runs: 1284, rating: 4.9 },
  { id: "m2", name: "Thread Smith", by: "@juni", char: "juni", cat: "Writing", desc: "Writes an X thread from a link, a launch or a rough idea.", skills: ["writer", "ideas"], price: 8, runs: 3410, rating: 4.8 },
  { id: "m3", name: "Paper Pal", by: "@tessa", char: "tessa", cat: "Knowledge", desc: "Paste a whitepaper and ask anything. It answers from the text only.", skills: ["docqa", "summary"], price: 10, runs: 902, rating: 4.9 },
  { id: "m4", name: "Bahasa Bridge", by: "@rumi", char: "rumi", cat: "Language", desc: "English to Indonesian and back, with slang that sounds local.", skills: ["translate", "writer"], price: 6, runs: 2210, rating: 4.7 },
  { id: "m5", name: "Code Clinic", by: "@gizmo", char: "gizmo", cat: "Code", desc: "Explains a smart contract or script line by line and flags risks.", skills: ["code"], price: 12, runs: 640, rating: 4.8 },
  { id: "m6", name: "Launch Planner", by: "@kofi", char: "kofi", cat: "Planning", desc: "A day-by-day launch plan for a token, app or community event.", skills: ["planner", "ideas"], price: 20, runs: 455, rating: 4.6 },
  { id: "m7", name: "Night Watch", by: "@bolt", char: "bolt", cat: "Research", desc: "A daily summary of one topic, with what changed since yesterday.", skills: ["research", "summary"], price: 9, runs: 1876, rating: 4.8 },
  { id: "m8", name: "Oracle Notes", by: "@sora", char: "sora", cat: "Writing", desc: "Rewrites a pitch or deck script so it is shorter and sharper.", skills: ["writer", "summary"], price: 14, runs: 731, rating: 4.9 },
];

export interface Leader {
  handle: string;
  agent: string;
  char: string;
  earned: number;
  delta: string;
  spark: number[];
}

export const LEADERS: readonly Leader[] = [
  { handle: "@juni", agent: "Thread Smith", char: "juni", earned: 2591, delta: "+18%", spark: [3, 4, 4, 6, 5, 7, 9, 8, 11, 12] },
  { handle: "@bolt", agent: "Night Watch", char: "bolt", earned: 1688, delta: "+11%", spark: [4, 5, 4, 6, 6, 7, 7, 8, 8, 10] },
  { handle: "@mika", agent: "Deal Desk", char: "mika", earned: 1540, delta: "+24%", spark: [2, 3, 3, 4, 6, 5, 7, 9, 9, 12] },
  { handle: "@rumi", agent: "Bahasa Bridge", char: "rumi", earned: 1259, delta: "+7%", spark: [5, 5, 6, 5, 6, 7, 6, 7, 8, 8] },
  { handle: "@sora", agent: "Oracle Notes", char: "sora", earned: 1023, delta: "+15%", spark: [2, 3, 4, 4, 5, 5, 6, 7, 8, 9] },
];

/** Landing metrics. The fourth (Whale fee) comes from TIERS, not from here. */
export const METRICS = [
  { value: 48210, dec: 0, prefix: "", suffix: "", label: "agents built" },
  { value: 1.9, dec: 1, prefix: "", suffix: "M", label: "tasks run" },
  { value: 412, dec: 0, prefix: "$", suffix: "K", label: "paid to creators" },
] as const;

/** Hero floating task card rotation. */
export const HERO_TASKS: readonly (readonly [string, string])[] = [
  ["is researching", "Comparing 4 sources"],
  ["is writing a thread", "Draft 2 of 3"],
  ["is translating", "English to Indonesian"],
  ["is planning a launch", "Step 3 of 5"],
  ["is reading a whitepaper", "Page 12 of 30"],
];

/** Bento "Earn on every run" tile. */
export const BENTO_EARN = { total: 2591, series: [12, 18, 15, 26, 22, 34, 30, 41, 38, 52, 48, 63, 70, 84] } as const;
