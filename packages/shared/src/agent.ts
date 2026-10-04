import { z } from "zod";
import { CHARACTERS, CharacterConfigSchema, type CharacterConfig } from "./characters";
import { LIMITS } from "./config";
import { SKILL_IDS, type SkillId } from "./skills";

export const TONES = ["Friendly", "Professional", "Concise"] as const;
export type Tone = (typeof TONES)[number];

/** Agents answer in English only (owner decision, October 2026). Kept as a list so more languages can be added later. */
export const LANGUAGES = ["English"] as const;
export type Language = (typeof LANGUAGES)[number];

export const AgentNameSchema = z.string().trim().min(1).max(LIMITS.nameMax);
export const InstructionsSchema = z.string().max(LIMITS.instructionsMax);
export const PriceSchema = z.number().int().min(LIMITS.priceMin).max(LIMITS.priceMax);
export const SkillListSchema = z
  .array(z.enum(SKILL_IDS))
  .max(LIMITS.skillsMax)
  .refine((a) => new Set(a).size === a.length, "Skills must be unique");

/** Fields an owner can edit in the studio. */
export const AgentDraftSchema = z
  .object({
    name: AgentNameSchema,
    instructions: InstructionsSchema,
    tone: z.enum(TONES),
    lang: z.enum(LANGUAGES),
    skills: SkillListSchema,
    price: PriceSchema,
    character: CharacterConfigSchema,
  })
  .strict();

export type AgentDraft = z.infer<typeof AgentDraftSchema>;

export const TaskSchema = z.string().trim().min(1).max(LIMITS.taskMax);

export const BASE_IDS = CHARACTERS.map((c) => c.id) as [string, ...string[]];
export const BaseIdSchema = z.enum(BASE_IDS);

/** POST /agents: a new agent (draft until published). */
export const AgentCreateSchema = AgentDraftSchema.extend({ baseId: BaseIdSchema }).strict();
/** PATCH /agents/:id: studio autosave sends only what changed. */
export const AgentPatchSchema = AgentDraftSchema.omit({ price: true }).extend({ baseId: BaseIdSchema }).partial().strict();
/** POST /agents/:id/publish */
export const PublishSchema = z.object({ published: z.boolean(), price: PriceSchema.optional() }).strict();
export const RatingSchema = z.object({ stars: z.number().int().min(1).max(5) }).strict();

/** An agent as its owner sees it (GET /agents/mine). */
export interface OwnAgent {
  id: string;
  slug: string;
  baseId: string;
  name: string;
  instructions: string;
  tone: Tone;
  lang: Language;
  skills: SkillId[];
  price: number;
  character: CharacterConfig;
  published: boolean;
  thumbnailUrl: string | null;
  runsCount: number;
  /** CR earned in total. */
  earned: number;
  rating: number | null;
  ratingCount: number;
}

/** An agent as everyone else sees it: never the instructions. */
export type PublicAgent = Omit<OwnAgent, "instructions" | "earned"> & { creator: string };

const PersonaSchema = z
  .object({
    name: AgentNameSchema,
    instructions: InstructionsSchema,
    tone: z.enum(TONES),
    lang: z.enum(LANGUAGES),
    skills: SkillListSchema.refine((a) => a.length > 0, "Equip at least one skill"),
  })
  .strict();

/** Earlier turns of the same chat, oldest first, so follow-ups ("make it shorter") have context. */
export const HistorySchema = z
  .array(z.object({ task: z.string().max(LIMITS.taskMax), answer: z.string().max(6000) }).strict())
  .max(4)
  .default([]);

/**
 * POST /runs body. The server sets the price in every case:
 * - studio: your own agent as it is in the studio right now (persona sent with the run)
 * - agent: a saved agent, looked up by id (published, or your own)
 * - example: one of the example agents in Discover
 */
export const PreviewRunSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("studio"), agent: PersonaSchema, skillId: z.enum(SKILL_IDS), task: TaskSchema, history: HistorySchema }).strict(),
  z.object({ source: z.literal("agent"), agentId: z.string().max(40), skillId: z.enum(SKILL_IDS), task: TaskSchema, history: HistorySchema }).strict(),
  z.object({ source: z.literal("example"), exampleId: z.string().max(40), skillId: z.enum(SKILL_IDS), task: TaskSchema, history: HistorySchema }).strict(),
]);

export type PreviewRun = z.input<typeof PreviewRunSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
