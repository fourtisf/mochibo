import { z } from "zod";
import { CharacterConfigSchema } from "./characters";
import { LIMITS } from "./config";
import { SKILL_IDS } from "./skills";

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

/**
 * POST /runs body during the preview. Agents are not saved on the server yet, so a studio run sends
 * the persona with the run (the owner's own instructions, sent only to our API). Example agents are
 * looked up on the server by id. The server sets the price either way. When agents are stored
 * (phase 2), a third source { kind: "agent", agentId } replaces the studio persona.
 */
const PersonaSchema = z
  .object({
    name: AgentNameSchema,
    instructions: InstructionsSchema,
    tone: z.enum(TONES),
    lang: z.enum(LANGUAGES),
    skills: SkillListSchema.refine((a) => a.length > 0, "Equip at least one skill"),
  })
  .strict();

export const PreviewRunSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("studio"), agent: PersonaSchema, skillId: z.enum(SKILL_IDS), task: TaskSchema }).strict(),
  z.object({ source: z.literal("example"), exampleId: z.string().max(40), skillId: z.enum(SKILL_IDS), task: TaskSchema }).strict(),
]);

export type PreviewRun = z.infer<typeof PreviewRunSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
