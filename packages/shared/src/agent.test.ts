import { describe, expect, it } from "vitest";
import { PreviewRunSchema } from "./agent";

const ok = {
  agent: { name: "Juni", instructions: "Be kind.", tone: "Friendly", lang: "English", skills: ["writer"] },
  skillId: "writer",
  task: "Write a post",
};

describe("PreviewRunSchema", () => {
  it("accepts a valid run", () => {
    expect(PreviewRunSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects a skill that is not equipped, unknown keys and limits", () => {
    expect(PreviewRunSchema.safeParse({ ...ok, skillId: "code" }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, task: "x".repeat(4001) }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, agent: { ...ok.agent, instructions: "x".repeat(2001) } }).success).toBe(false);
    expect(PreviewRunSchema.safeParse({ ...ok, agent: { ...ok.agent, skills: ["writer", "code", "ideas", "summary", "planner"] } }).success).toBe(false);
  });
});
