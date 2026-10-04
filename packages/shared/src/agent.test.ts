import { describe, expect, it } from "vitest";
import { PreviewRunSchema } from "./agent";

const ok = {
  source: "studio",
  agent: { name: "Juni", instructions: "Be kind.", tone: "Friendly", lang: "English", skills: ["writer"] },
  skillId: "writer",
  task: "Write a post",
};

describe("PreviewRunSchema", () => {
  it("accepts a valid run", () => {
    expect(PreviewRunSchema.safeParse(ok).success).toBe(true);
  });
  it("accepts an example run by id", () => {
    expect(PreviewRunSchema.safeParse({ source: "example", exampleId: "m1", skillId: "research", task: "TSLA" }).success).toBe(true);
  });
  it("rejects unknown keys and limits", () => {
    expect(PreviewRunSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, task: "x".repeat(4001) }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, agent: { ...ok.agent, instructions: "x".repeat(2001) } }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, agent: { ...ok.agent, skills: ["writer", "code", "ideas", "summary", "planner"] } }).success).toBe(false);
  });
});
