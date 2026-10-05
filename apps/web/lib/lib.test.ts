import { describe, expect, it } from "vitest";
import { slugify, sparkPath, shortAddress } from "./format";
import { MARKET } from "./placeholder";
import { buildScript, clipLines, pickFormat, wrapText } from "./video";
import { fromUtc, toUtc } from "./autopilot";
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

describe("talk", () => {
  it("takes finished sentences from the front and keeps the rest", async () => {
    const { takeSentences } = await import("./talk");
    expect(takeSentences("Hi there. Version 3.5 is out! And mo", false)).toEqual({ sentences: ["Hi there.", "Version 3.5 is out!"], rest: " And mo" });
    expect(takeSentences("Ends with 3.", false).sentences).toEqual([]);
    expect(takeSentences("- Point one\n- Point two", true).sentences).toEqual(["Point one", "Point two"]);
    const long = takeSentences(`${"word ".repeat(60)}end.`, true).sentences;
    expect(long.length).toBeGreaterThan(1);
    expect(long.every((s) => s.length <= 150)).toBe(true);
  });
});

describe("answer video script", () => {
  it("starts with an intro, shows every sentence in order and ends with the outro", () => {
    const s = buildScript("First point here. Second point is a bit longer than the first one. Third.");
    expect(s.segments.map((x) => x.kind)).toEqual(["intro", "line", "line", "line", "outro"]);
    expect(s.segments[1].text).toBe("First point here.");
    for (let i = 1; i < s.segments.length; i++) expect(s.segments[i].start).toBeGreaterThanOrEqual(s.segments[i - 1].end);
    expect(s.total).toBe(s.segments.at(-1)!.end);
    expect(s.truncated).toBe(false);
  });

  it("cuts long answers to the time limit", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} says something useful about the token.`).join(" ");
    const s = buildScript(long, 40);
    expect(s.truncated).toBe(true);
    expect(s.total).toBeLessThanOrEqual(40);
    expect(s.segments.filter((x) => x.kind === "line").length).toBeGreaterThan(3);
  });

  it("wraps and clips caption lines", () => {
    const measure = (t: string) => t.length * 10;
    const lines = wrapText(measure, "one two three four five six seven", 100);
    expect(lines).toEqual(["one two", "three four", "five six", "seven"]);
    expect(clipLines(measure, lines, 2, 100)).toEqual(["one two", "three…"]);
  });

  it("prefers MP4 and falls back to WebM", () => {
    expect(pickFormat((t) => t.startsWith("video/mp4"))?.ext).toBe("mp4");
    expect(pickFormat((t) => t === "video/webm")).toEqual({ mime: "video/webm", ext: "webm" });
    expect(pickFormat(() => false)).toBeNull();
  });
});

describe("autopilot times", () => {
  it("turns a local time into UTC and back", () => {
    for (const t of ["00:00", "09:30", "23:45"]) {
      const daily = toUtc(t, null);
      expect(fromUtc(daily.minute, null).time).toBe(t);
      for (const wd of [0, 3, 6]) {
        const weekly = toUtc(t, wd);
        expect(fromUtc(weekly.minute, weekly.weekday)).toEqual({ time: t, weekday: wd });
      }
    }
  });
});
