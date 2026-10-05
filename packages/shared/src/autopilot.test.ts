import { describe, expect, it } from "vitest";
import { AutopilotCreateSchema, nextRunAfter } from "./autopilot";

const at = (s: string) => new Date(s);

describe("autopilot schedule", () => {
  it("runs daily at the chosen UTC minute, always in the future", () => {
    expect(nextRunAfter("daily", 9 * 60, null, at("2026-10-05T08:00:00Z")).toISOString()).toBe("2026-10-05T09:00:00.000Z");
    expect(nextRunAfter("daily", 9 * 60, null, at("2026-10-05T09:00:00Z")).toISOString()).toBe("2026-10-06T09:00:00.000Z");
  });

  it("runs every 6 hours from the anchor minute", () => {
    expect(nextRunAfter("6h", 30, null, at("2026-10-05T07:00:00Z")).toISOString()).toBe("2026-10-05T12:30:00.000Z");
    expect(nextRunAfter("6h", 30, null, at("2026-10-05T23:00:00Z")).toISOString()).toBe("2026-10-06T00:30:00.000Z");
  });

  it("runs weekly on the chosen weekday", () => {
    // 2026-10-05 is a Monday; ask for Friday (5) at 18:00 UTC.
    expect(nextRunAfter("weekly", 18 * 60, 5, at("2026-10-05T10:00:00Z")).toISOString()).toBe("2026-10-09T18:00:00.000Z");
    expect(nextRunAfter("weekly", 18 * 60, 1, at("2026-10-05T18:00:00Z")).toISOString()).toBe("2026-10-12T18:00:00.000Z");
  });

  it("needs a weekday for weekly runs and a task", () => {
    const base = { target: { kind: "agent", id: "a1" }, skillId: "writer", task: "Tweets", every: "weekly", minute: 60 };
    expect(AutopilotCreateSchema.safeParse(base).success).toBe(false);
    expect(AutopilotCreateSchema.safeParse({ ...base, weekday: 3 }).success).toBe(true);
    expect(AutopilotCreateSchema.safeParse({ ...base, weekday: 3, task: "  " }).success).toBe(false);
  });
});
