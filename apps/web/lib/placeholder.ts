/**
 * EXAMPLE CONTENT (preview).
 * Example agents and illustrative UI values. They are labelled as examples on the page and
 * never presented as real usage. Phase 3 reads real agents and stats from the API
 * (/discover, /leaderboard, /stats) and deletes this file.
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
  { id: "m1", name: "Deal Desk", by: "Mika", char: "mika", cat: "Research", desc: "Turns a token or stock ticker into a one-page brief with the main risks.", skills: ["research", "summary"], price: 15, runs: 1284, rating: 4.9 },
  { id: "m2", name: "Thread Smith", by: "Juni", char: "juni", cat: "Writing", desc: "Writes an X thread from a link, a launch or a rough idea.", skills: ["writer", "ideas"], price: 8, runs: 3410, rating: 4.8 },
  { id: "m3", name: "Paper Pal", by: "Tessa", char: "tessa", cat: "Knowledge", desc: "Paste a whitepaper and ask anything. It answers from the text only.", skills: ["docqa", "summary"], price: 10, runs: 902, rating: 4.9 },
  { id: "m4", name: "Bahasa Bridge", by: "Rumi", char: "rumi", cat: "Language", desc: "English to Indonesian and back, with slang that sounds local.", skills: ["translate", "writer"], price: 6, runs: 2210, rating: 4.7 },
  { id: "m5", name: "Code Clinic", by: "Gizmo", char: "gizmo", cat: "Code", desc: "Explains a smart contract or script line by line and flags risks.", skills: ["code"], price: 12, runs: 640, rating: 4.8 },
  { id: "m6", name: "Launch Planner", by: "Kofi", char: "kofi", cat: "Planning", desc: "A day-by-day launch plan for a token, app or community event.", skills: ["planner", "ideas"], price: 20, runs: 455, rating: 4.6 },
  { id: "m7", name: "Night Watch", by: "Bolt", char: "bolt", cat: "Research", desc: "A daily summary of one topic, with what changed since yesterday.", skills: ["research", "summary"], price: 9, runs: 1876, rating: 4.8 },
  { id: "m8", name: "Oracle Notes", by: "Sora", char: "sora", cat: "Writing", desc: "Rewrites a pitch or deck script so it is shorter and sharper.", skills: ["writer", "summary"], price: 14, runs: 731, rating: 4.9 },
];

/** Hero floating task card rotation. */
export const HERO_TASKS: readonly (readonly [string, string])[] = [
  ["is researching", "Comparing 4 sources"],
  ["is writing a thread", "Draft 2 of 3"],
  ["is translating", "English to Indonesian"],
  ["is planning a launch", "Step 3 of 5"],
  ["is reading a whitepaper", "Page 12 of 30"],
];

/** Bento "Earn on every run" tile (an illustrative example week). */
export const BENTO_EARN = { total: 2591, series: [12, 18, 15, 26, 22, 34, 30, 41, 38, 52, 48, 63, 70, 84] } as const;
