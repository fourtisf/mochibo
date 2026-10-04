import { describe, expect, it } from "vitest";
import { slugify, sparkPath, shortAddress } from "./format";
import { MARKET } from "./placeholder";
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

describe("placeholder data", () => {
  it("only references real characters and skills", () => {
    for (const m of MARKET) {
      expect(CHARACTER_BY_ID[m.char], m.id).toBeDefined();
      for (const s of m.skills) expect(SKILL_BY_ID[s], s).toBeDefined();
    }
  });
});
