/**
 * Example agents shown in Discover during the preview. They live here (not in the web app) so the
 * API can price their runs: the server never trusts a price sent by the browser. Labelled as
 * examples on the page. Real published agents replace them once agents are stored.
 */
import type { SkillCategory, SkillId } from "./skills";

export interface ExampleAgent {
  id: string;
  name: string;
  /** Name shown as the example's maker. */
  by: string;
  /** Base character id the card shows. */
  char: string;
  cat: SkillCategory;
  /** Shown on the card and used as the agent's instructions. */
  desc: string;
  skills: SkillId[];
  /** Whole CR per run. */
  price: number;
}

export const EXAMPLE_AGENTS: readonly ExampleAgent[] = [
  { id: "m1", name: "Deal Desk", by: "Mika", char: "mika", cat: "Research", desc: "Turns a token or stock ticker into a one-page brief with the main risks.", skills: ["research", "summary"], price: 15 },
  { id: "m2", name: "Thread Smith", by: "Juni", char: "juni", cat: "Writing", desc: "Writes an X thread from a link, a launch or a rough idea.", skills: ["writer", "ideas"], price: 8 },
  { id: "m3", name: "Paper Pal", by: "Tessa", char: "tessa", cat: "Knowledge", desc: "Paste a whitepaper and ask anything. It answers from the text only.", skills: ["docqa", "summary"], price: 10 },
  { id: "m4", name: "Lingo Bridge", by: "Rumi", char: "rumi", cat: "Language", desc: "Translates posts and replies into Spanish, French, Japanese and more, with slang that sounds local.", skills: ["translate", "writer"], price: 6 },
  { id: "m5", name: "Code Clinic", by: "Gizmo", char: "gizmo", cat: "Code", desc: "Explains a smart contract or script line by line and flags risks.", skills: ["code"], price: 12 },
  { id: "m6", name: "Launch Planner", by: "Kofi", char: "kofi", cat: "Planning", desc: "A day-by-day launch plan for a token, app or community event.", skills: ["planner", "ideas"], price: 20 },
  { id: "m7", name: "Night Watch", by: "Bolt", char: "bolt", cat: "Research", desc: "A daily summary of one topic, with what changed since yesterday.", skills: ["research", "summary"], price: 9 },
  { id: "m8", name: "Oracle Notes", by: "Sora", char: "sora", cat: "Writing", desc: "Rewrites a pitch or deck script so it is shorter and sharper.", skills: ["writer", "summary"], price: 14 },
];

export const EXAMPLE_BY_ID: Readonly<Record<string, ExampleAgent>> = Object.fromEntries(EXAMPLE_AGENTS.map((a) => [a.id, a]));
