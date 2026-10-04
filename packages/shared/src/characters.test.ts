import { describe, expect, it } from "vitest";
import { CHARACTERS, CharacterConfigSchema, DEFAULT_CHARACTER, CHIPS, PALETTES } from "./characters";
import { AgentDraftSchema } from "./agent";
import { tierForBalance, formatBps, TIERS, LIMITS } from "./config";
import { SKILL_EXAMPLES, SKILL_IDS } from "./skills";

describe("CharacterConfig", () => {
  it("accepts the defaults and all 12 base characters", () => {
    expect(CharacterConfigSchema.safeParse(DEFAULT_CHARACTER).success).toBe(true);
    expect(CHARACTERS).toHaveLength(12);
    expect(CHARACTERS.filter((c) => c.config.kind === "bot")).toHaveLength(4);
    for (const c of CHARACTERS) expect(CharacterConfigSchema.safeParse(c.config).success, c.id).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, id: "juni" }).success).toBe(false);
  });

  it("rejects colors that are not #RRGGBB", () => {
    for (const bad of ["#FFF", "red", "#GGGGGG", "#12345678", "rgb(0,0,0)"]) {
      expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, glow: bad }).success, bad).toBe(false);
    }
  });

  it("rejects values outside the chip lists", () => {
    expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, hair: "mohawk" }).success).toBe(false);
    expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, hat: "tophat" }).success).toBe(false);
  });

  it("chip and palette values all pass the schema", () => {
    for (const [v] of CHIPS.hair) expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, hair: v }).success).toBe(true);
    for (const [v] of CHIPS.hat) expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, hat: v }).success).toBe(true);
    for (const v of PALETTES.glow) expect(CharacterConfigSchema.safeParse({ ...DEFAULT_CHARACTER, glow: v }).success).toBe(true);
  });
});

describe("AgentDraft", () => {
  const ok = { name: "My Juni", instructions: "", tone: "Friendly", lang: "English", skills: ["writer"], price: 12, character: DEFAULT_CHARACTER };
  it("accepts a valid draft", () => expect(AgentDraftSchema.safeParse(ok).success).toBe(true));
  it("limits name, skills and price", () => {
    expect(AgentDraftSchema.safeParse({ ...ok, name: "x".repeat(33) }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, name: " " }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, skills: ["writer", "ideas", "code", "summary", "planner"] }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, skills: ["writer", "writer"] }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, skills: ["hack"] }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, price: 501 }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, price: 1.5 }).success).toBe(false);
    expect(AgentDraftSchema.safeParse({ ...ok, instructions: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("tiers", () => {
  it("maps balances to tiers", () => {
    expect(tierForBalance(0).id).toBe("FREE");
    expect(tierForBalance(999_999).id).toBe("FREE");
    expect(tierForBalance(1_000_000).id).toBe("HOLDER");
    expect(tierForBalance(5_000_000).id).toBe("BUILDER");
    expect(tierForBalance(25_000_000).id).toBe("WHALE");
  });
  it("formats fees", () => {
    expect(TIERS.map((t) => formatBps(t.feeBps))).toEqual(["5%", "4%", "2.5%", "0%"]);
  });
});

describe("skill examples", () => {
  it("has three runnable examples for every skill", () => {
    for (const id of SKILL_IDS) {
      expect(SKILL_EXAMPLES[id]).toHaveLength(3);
      for (const t of SKILL_EXAMPLES[id]) expect(t.length).toBeLessThanOrEqual(LIMITS.taskMax);
    }
  });
});
