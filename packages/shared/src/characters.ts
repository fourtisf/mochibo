import { z } from "zod";

/* Allowed values, copied from CHIPS in the prototype. */
export const HAIR_STYLES = ["messy", "bob", "buns", "pony", "long", "curly", "spiky", "buzz"] as const;
export const TOP_STYLES = ["hoodie", "bomber", "tee", "overalls"] as const;
export const MOUTHS = ["smile", "cat"] as const;
export const HATS = ["none", "beanie", "cap", "catears", "halo", "headphones", "crown", "diamond"] as const;
export const GLASSES = ["none", "round", "shades"] as const;
export const BACKS = ["none", "backpack", "wings", "cape", "jetpack", "aura", "goldwings", "galaxy"] as const;
/* crown, diamond, aura, goldwings and galaxy are rare items, unlocked by level (see levels.ts). */
export const LEGS = ["legs", "hover"] as const;
export const KINDS = ["human", "bot"] as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be #RRGGBB");

/**
 * The look of an agent. Stored as JSON on the agent. Unknown keys are rejected.
 * Bots ignore the human-only fields (hair, face, top style, glasses, beanie, cap).
 */
export const CharacterConfigSchema = z
  .object({
    kind: z.enum(KINDS),
    skin: hex,
    hair: z.enum(HAIR_STYLES),
    hairC: hex,
    eyeC: hex,
    mouth: z.enum(MOUTHS),
    blush: z.boolean(),
    freckles: z.boolean(),
    lashes: z.boolean(),
    top: z.enum(TOP_STYLES),
    topC: hex,
    bottomC: hex,
    shoeC: hex,
    accC: hex,
    glow: hex,
    hat: z.enum(HATS),
    glasses: z.enum(GLASSES),
    back: z.enum(BACKS),
    buddy: z.boolean(),
    legs: z.enum(LEGS),
  })
  .strict();

export type CharacterConfig = z.infer<typeof CharacterConfigSchema>;
export type CharacterKey = keyof CharacterConfig;
export type ColorKey = "skin" | "hairC" | "eyeC" | "topC" | "bottomC" | "shoeC" | "accC" | "glow";

/** Defaults (DEF in the prototype). */
export const DEFAULT_CHARACTER: CharacterConfig = {
  kind: "human",
  skin: "#F3CDB0",
  hair: "messy",
  hairC: "#2A1B12",
  eyeC: "#7C5CFF",
  mouth: "smile",
  blush: true,
  freckles: false,
  lashes: false,
  top: "hoodie",
  topC: "#8B7CFF",
  bottomC: "#2B2456",
  shoeC: "#F5F3FF",
  accC: "#FFB38A",
  glow: "#8B7CFF",
  hat: "none",
  glasses: "none",
  back: "none",
  buddy: false,
  legs: "legs",
};

export interface BaseCharacter {
  id: string;
  name: string;
  role: string;
  config: CharacterConfig;
}

type Partial12 = { id: string; name: string; role: string } & Partial<CharacterConfig>;

const RAW: Partial12[] = [
  { id: "juni", name: "Juni", role: "Creative", skin: "#F6D2B8", hair: "buns", hairC: "#FF8FB8", eyeC: "#7C5CFF", top: "hoodie", topC: "#8B7CFF", bottomC: "#2B2456", shoeC: "#F5F3FF", accC: "#6EF0D2", glow: "#FF8FB8", lashes: true, buddy: true },
  { id: "arlo", name: "Arlo", role: "Operator", skin: "#E9B994", hair: "messy", hairC: "#2A1B12", eyeC: "#3FA7FF", top: "bomber", topC: "#3D4BD8", bottomC: "#1E2240", shoeC: "#F5F3FF", accC: "#FFB38A", glow: "#6EF0D2", hat: "headphones", back: "backpack" },
  { id: "pip", name: "Pip", role: "Research bot", kind: "bot", topC: "#E8ECFF", bottomC: "#8B7CFF", shoeC: "#2B2456", accC: "#8B7CFF", glow: "#6EF0D2", legs: "hover" },
  { id: "kofi", name: "Kofi", role: "Strategist", skin: "#8D5A3B", hair: "curly", hairC: "#1A120C", eyeC: "#B07A3B", top: "tee", topC: "#FF9F7A", bottomC: "#26305A", shoeC: "#6EF0D2", accC: "#FFE27A", glow: "#FFB38A", glasses: "round" },
  { id: "mika", name: "Mika", role: "Trader", skin: "#F3CDB0", hair: "spiky", hairC: "#EDE9FF", eyeC: "#6EF0D2", top: "bomber", topC: "#241E52", bottomC: "#15112F", shoeC: "#6EF0D2", accC: "#6EF0D2", glow: "#6EF0D2", glasses: "shades", mouth: "cat" },
  { id: "bolt", name: "Bolt", role: "Sentinel bot", kind: "bot", topC: "#6C5CE7", bottomC: "#2B2456", shoeC: "#1E1946", accC: "#FFB38A", glow: "#FFB38A", back: "cape" },
  { id: "tessa", name: "Tessa", role: "Scholar", skin: "#E2A982", hair: "bob", hairC: "#4A2A1A", eyeC: "#2E9C7E", top: "overalls", topC: "#F5F3FF", bottomC: "#3E5BA9", shoeC: "#FF8FB8", accC: "#FFE27A", glow: "#7CC8FF", glasses: "round", mouth: "cat", freckles: true },
  { id: "rumi", name: "Rumi", role: "Storyteller", skin: "#C98E68", hair: "long", hairC: "#2B1A10", eyeC: "#A65CFF", top: "hoodie", topC: "#2FB89C", bottomC: "#2A2350", shoeC: "#F5F3FF", accC: "#FFB38A", glow: "#6EF0D2", hat: "beanie" },
  { id: "sora", name: "Sora", role: "Oracle", skin: "#FBE3D3", hair: "long", hairC: "#CFC6FF", eyeC: "#FF8FB8", top: "tee", topC: "#F5F3FF", bottomC: "#6C5CE7", shoeC: "#CFC6FF", accC: "#FF8FB8", glow: "#CFC6FF", hat: "halo", back: "wings", lashes: true },
  { id: "gizmo", name: "Gizmo", role: "Workshop bot", kind: "bot", topC: "#FFB38A", bottomC: "#3A3266", shoeC: "#2B2456", accC: "#FF8FB8", glow: "#6EF0D2", hat: "catears", back: "jetpack" },
  { id: "dara", name: "Dara", role: "Navigator", skin: "#A86B4C", hair: "pony", hairC: "#120C08", eyeC: "#FFB38A", top: "bomber", topC: "#FF8FB8", bottomC: "#1E2240", shoeC: "#F5F3FF", accC: "#2B2456", glow: "#FFB38A", hat: "cap" },
  { id: "momo", name: "Momo", role: "Companion bot", kind: "bot", topC: "#CFF7EC", bottomC: "#FF8FB8", shoeC: "#2B2456", accC: "#FF8FB8", glow: "#FF8FB8", legs: "hover", hat: "catears", buddy: true },
];

/** The 12 base characters (8 humans, 4 bots), in roster order. */
export const CHARACTERS: readonly BaseCharacter[] = RAW.map(({ id, name, role, ...rest }) => ({
  id,
  name,
  role,
  config: { ...DEFAULT_CHARACTER, ...rest },
}));

export const CHARACTER_BY_ID: Readonly<Record<string, BaseCharacter>> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

/** Fill missing fields with defaults. Does not validate; use CharacterConfigSchema for untrusted input. */
export function normalizeCharacter(c: Partial<CharacterConfig>): CharacterConfig {
  return { ...DEFAULT_CHARACTER, ...c };
}

/** Swatch palettes (PAL in the prototype). */
export const PALETTES: Record<ColorKey, readonly string[]> = {
  skin: ["#FBE3D3", "#F6D2B8", "#F0C29E", "#E2A982", "#C98E68", "#A86B4C", "#8D5A3B", "#5E3A26"],
  hairC: ["#120C08", "#2A1B12", "#4A2A1A", "#C68A4E", "#FFE27A", "#EDE9FF", "#CFC6FF", "#FF8FB8", "#6EF0D2", "#5865F2"],
  eyeC: ["#7C5CFF", "#3FA7FF", "#2E9C7E", "#B07A3B", "#FF8FB8", "#6EF0D2", "#FFB38A", "#A65CFF"],
  topC: ["#8B7CFF", "#3D4BD8", "#6EF0D2", "#2FB89C", "#FF8FB8", "#FF9F7A", "#FFE27A", "#F5F3FF", "#241E52", "#C2416B"],
  bottomC: ["#2B2456", "#15112F", "#1E2240", "#3E5BA9", "#6C5CE7", "#26305A", "#5E3A26", "#F5F3FF"],
  shoeC: ["#F5F3FF", "#2B2456", "#6EF0D2", "#FF8FB8", "#FFB38A", "#7CC8FF"],
  accC: ["#FFB38A", "#6EF0D2", "#FF8FB8", "#FFE27A", "#8B7CFF", "#7CC8FF", "#2B2456", "#F5F3FF"],
  glow: ["#8B7CFF", "#6EF0D2", "#FF8FB8", "#FFB38A", "#7CC8FF", "#CFC6FF", "#FFE27A"],
};

/** A chip option: value, label, and whether it only applies to humans. */
export type ChipOption = readonly [value: string, label: string, humanOnly?: boolean];

/** Chip groups (CHIPS in the prototype). `buddy` maps to a boolean: "on" / "off". */
export const CHIPS = {
  hair: [["messy", "Messy"], ["bob", "Bob"], ["buns", "Buns"], ["pony", "Ponytail"], ["long", "Long"], ["curly", "Curly"], ["spiky", "Spiky"], ["buzz", "Buzz"]],
  top: [["hoodie", "Hoodie"], ["bomber", "Bomber"], ["tee", "T-shirt"], ["overalls", "Overalls"]],
  mouth: [["smile", "Smile"], ["cat", "Cat mouth"]],
  hat: [["none", "None"], ["beanie", "Beanie", true], ["cap", "Cap", true], ["catears", "Cat ears"], ["halo", "Halo"], ["headphones", "Headphones"]],
  glasses: [["none", "None"], ["round", "Round"], ["shades", "Shades"]],
  back: [["none", "None"], ["backpack", "Backpack"], ["wings", "Wings"], ["cape", "Cape"], ["jetpack", "Jetpack"]],
  buddy: [["off", "None"], ["on", "Floating buddy"]],
  legs: [["legs", "Walks"], ["hover", "Hovers"]],
} as const satisfies Record<string, readonly ChipOption[]>;

export type ChipKey = keyof typeof CHIPS;
