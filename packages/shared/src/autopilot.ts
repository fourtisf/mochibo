/*
 * Autopilot: an agent runs a task on a schedule by itself (every 6 hours, daily or weekly) and the
 * results land in the owner's inbox. Each run is paid in credits like any run; out of credits
 * pauses the autopilot. Times are stored in UTC; the studio shows them in the visitor's time.
 */
import { z } from "zod";
import { LIMITS } from "./config";
import { SKILL_IDS } from "./skills";

export const AUTOPILOT = {
  /** Autopilots one wallet can have. */
  maxPerWallet: 5,
  /** Failed runs in a row before an autopilot pauses itself. */
  maxFailures: 3,
  /** Results kept per autopilot (older ones are deleted). */
  keepResults: 30,
} as const;

export const AUTOPILOT_EVERY = ["6h", "daily", "weekly"] as const;
export type AutopilotEvery = (typeof AUTOPILOT_EVERY)[number];
export const AUTOPILOT_EVERY_LABEL: Record<AutopilotEvery, string> = { "6h": "Every 6 hours", daily: "Every day", weekly: "Every week" };

const MINUTES_PER_DAY = 1440;

/**
 * The next run strictly after `from`. `minute` is minutes after midnight UTC (0 to 1439); weekly
 * runs also need `weekday` (0 = Sunday, UTC). Every 6 hours runs at `minute` and every 6 hours after.
 */
export function nextRunAfter(every: AutopilotEvery, minute: number, weekday: number | null, from: Date): Date {
  const dayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const slots = every === "6h" ? [0, 1, 2, 3].map((k) => (minute + k * 360) % MINUTES_PER_DAY).sort((a, b) => a - b) : [minute];
  for (let d = 0; d <= 8; d++) {
    const base = dayStart + d * 86_400_000;
    if (every === "weekly" && new Date(base).getUTCDay() !== (weekday ?? 0)) continue;
    for (const m of slots) {
      const t = base + m * 60_000;
      if (t > from.getTime()) return new Date(t);
    }
  }
  throw new Error("no next run");
}

export const AutopilotTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent"), id: z.string().min(1).max(40) }).strict(),
  z.object({ kind: z.literal("example"), id: z.string().min(1).max(20) }).strict(),
]);

const scheduleFields = {
  every: z.enum(AUTOPILOT_EVERY),
  minute: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
};

export const AutopilotCreateSchema = z
  .object({
    target: AutopilotTargetSchema,
    skillId: z.enum(SKILL_IDS),
    task: z.string().trim().min(1, "Describe the task.").max(LIMITS.instructionsMax),
    ...scheduleFields,
  })
  .strict()
  .refine((d) => d.every !== "weekly" || d.weekday !== null, { message: "Pick a day for a weekly autopilot.", path: ["weekday"] });
export type AutopilotCreate = z.input<typeof AutopilotCreateSchema>;

export const AutopilotPatchSchema = z
  .object({
    enabled: z.boolean(),
    skillId: z.enum(SKILL_IDS),
    task: z.string().trim().min(1).max(LIMITS.instructionsMax),
    every: scheduleFields.every,
    minute: scheduleFields.minute,
    weekday: z.number().int().min(0).max(6).nullable(),
  })
  .partial()
  .strict();

export interface AutopilotView {
  id: string;
  name: string;
  agentId: string | null;
  exampleId: string | null;
  skillId: string;
  task: string;
  every: AutopilotEvery;
  minute: number;
  weekday: number | null;
  enabled: boolean;
  /** Why it paused itself (out of credits, agent gone, too many failures), or null. */
  pausedReason: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "done" | "failed" | "skipped" | "paused" | null;
}

export interface AutopilotResultView {
  id: string;
  autopilotId: string;
  name: string;
  task: string;
  status: "done" | "failed" | "skipped" | "paused";
  text: string;
  read: boolean;
  createdAt: string;
}

/** Ideas for the task box. Links in a task are read on every run, so a page can be watched. */
export const AUTOPILOT_IDEAS: readonly { skillId: (typeof SKILL_IDS)[number]; every: AutopilotEvery; task: string }[] = [
  { skillId: "writer", every: "daily", task: "Write 3 fresh tweet ideas for my memecoin community today. Fun, short, no price promises." },
  { skillId: "ideas", every: "weekly", task: "Plan next week's content: one post idea per day, with a hook for each." },
  { skillId: "summary", every: "daily", task: "Summarize what is new on https://example.com/blog in 3 points." },
  { skillId: "writer", every: "daily", task: "Teach one crypto safety tip in a short post: scams, wallets or rug pull signs." },
];
