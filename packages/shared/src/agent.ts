import { z } from "zod";
import { CharacterConfigSchema } from "./characters";
import { LIMITS } from "./config";
import { SKILL_IDS } from "./skills";

export const TONES = ["Friendly", "Professional", "Concise"] as const;
export type Tone = (typeof TONES)[number];

export const LANGUAGES = ["English", "Indonesian"] as const;
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
