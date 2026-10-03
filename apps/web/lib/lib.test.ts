import { describe, expect, it } from "vitest";
import { SKILL_IDS } from "@orbis/shared";
import { slugify, sparkPath, shortAddress } from "./format";
import { sampleAnswer } from "./preview/sample";
import { MARKET, LEADERS } from "./placeholder";
import { CHARACTER_BY_ID, SKILL_BY_ID } from "@orbis/shared";

describe("format", () => {
  it("slugifies names for public links", () => {
    expect(slugify("My Juni")).toBe("my-juni");
    expect(slugify("  Déjà  Vu!! ")).toBe("deja-vu");
    expect(slugify("!!!")).toBe("agent");
  });
  it("draws sparklines inside the box", () => {
    const d = sparkPath([1, 2, 3], 90, 30);
    expect(d).toBe("M0.0 27.0 L45.0 15.0 L90.0 3.0");
    expect(sparkPath([5, 5], 10, 10)).toBe("M0.0 7.0 L10.0 7.0");
  });
  it("shortens addresses", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});

describe("preview samples", () => {
  it("has an English and Indonesian answer for every skill", () => {
    for (const id of SKILL_IDS) {
      expect(sampleAnswer(id, "x", "English").length).toBeGreaterThan(20);
      // The code explainer sample does not echo the task (same as the prototype).
      if (id === "code") continue;
      expect(sampleAnswer(id, "launch plan", "English")).toContain("launch plan");
      expect(sampleAnswer(id, "launch plan", "Indonesian")).toContain("launch plan");
    }
  });
  it("trims long tasks", () => {
    expect(sampleAnswer("summary", "x".repeat(100), "English")).toContain("x".repeat(70) + "…");
  });
});

describe("placeholder data", () => {
  it("only references real characters and skills", () => {
    for (const m of MARKET) {
      expect(CHARACTER_BY_ID[m.char], m.id).toBeDefined();
      for (const s of m.skills) expect(SKILL_BY_ID[s], s).toBeDefined();
    }
    for (const l of LEADERS) expect(CHARACTER_BY_ID[l.char]).toBeDefined();
  });
});
