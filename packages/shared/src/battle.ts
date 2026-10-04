/*
 * Agent Battle: two agents face off on one stage, a roast or a bull vs bear debate, three lines
 * each. People vote for a day; the winner's creator gets a prize and the agent gets level points.
 */
import { z } from "zod";
import type { CharacterConfig } from "./characters";

export const BATTLE = {
  /** Default price to start a battle, in CR (the API's BATTLE_COST_CR can change it). */
  costCr: 15,
  /** Paid to the winning agent's creator, in CR (BATTLE_PRIZE_CR). */
  prizeCr: 5,
  /** Lines per fighter. */
  rounds: 3,
  /** How long voting stays open. */
  voteHours: 24,
  topicMax: 200,
} as const;

export const BATTLE_MODES = ["roast", "debate"] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];
export const BATTLE_MODE_LABEL: Record<BattleMode, string> = { roast: "Roast battle", debate: "Bull vs bear" };

/** Ideas for the topic box. */
export const BATTLE_TOPICS: Record<BattleMode, readonly string[]> = {
  roast: ["Who has the worst trading habits", "Whose look is more 2021", "Who would rug first"],
  debate: ["$MOCHI hits a billion market cap this cycle", "Memecoins are better than blue chips", "AI agents are the next big crypto narrative"],
};

export const FighterRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent"), id: z.string().min(1).max(40) }).strict(),
  z.object({ kind: z.literal("example"), id: z.string().min(1).max(20) }).strict(),
]);
export type FighterRef = z.infer<typeof FighterRefSchema>;

export const BattleStartSchema = z
  .object({
    mode: z.enum(BATTLE_MODES),
    topic: z.string().trim().max(BATTLE.topicMax).default(""),
    a: FighterRefSchema,
    b: FighterRefSchema,
  })
  .strict()
  .refine((d) => d.mode !== "debate" || d.topic.length > 0, { message: "Give the debate a topic.", path: ["topic"] })
  .refine((d) => d.a.kind !== d.b.kind || d.a.id !== d.b.id, { message: "Pick two different agents.", path: ["b"] });
export type BattleStart = z.input<typeof BattleStartSchema>;

export const BattleVoteSchema = z.object({ side: z.enum(["a", "b"]) }).strict();

export type Side = "a" | "b";

export interface BattleLine {
  side: Side;
  text: string;
}

export interface BattleFighter {
  name: string;
  character: CharacterConfig;
  /** Share page of a published agent, if any. */
  slug: string | null;
  /** Set for example agents. */
  exampleId: string | null;
  /** Base character, for the pre-rendered portrait when there is no uploaded one. */
  baseId: string;
  /** Uploaded portrait of a published agent. */
  thumb: string | null;
}

export interface BattleView {
  slug: string;
  mode: BattleMode;
  topic: string;
  a: BattleFighter;
  b: BattleFighter;
  lines: BattleLine[];
  status: "running" | "open" | "closed" | "failed";
  votes: { a: number; b: number };
  winner: Side | "tie" | null;
  endsAt: string | null;
  createdAt: string;
  /** The signed-in visitor's vote. */
  myVote: Side | null;
}
