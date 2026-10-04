import { describe, expect, it } from "vitest";
import { DEFAULT_CHARACTER } from "./characters";
import { LEVEL_XP, MAX_LEVEL, RARE_ITEMS, levelFor, lockMessage, lockedItem, unlockedBetween } from "./levels";

describe("levels", () => {
  it("maps points to levels and the next goal", () => {
    expect(levelFor(0)).toEqual({ level: 1, xp: 0, floor: 0, next: 5 });
    expect(levelFor(4).level).toBe(1);
    expect(levelFor(5).level).toBe(2);
    expect(levelFor(39)).toMatchObject({ level: 3, floor: 15, next: 40 });
    expect(levelFor(10_000)).toMatchObject({ level: MAX_LEVEL, next: null });
    expect(LEVEL_XP.length).toBe(MAX_LEVEL);
  });

  it("locks rare items by level and holder tier", () => {
    const look = { ...DEFAULT_CHARACTER, back: "goldwings" as const };
    expect(lockedItem(look, 2, "FREE")?.id).toBe("goldwings");
    expect(lockedItem(look, 3, "FREE")).toBeNull();
    expect(lockedItem({ ...DEFAULT_CHARACTER, hat: "diamond" }, MAX_LEVEL, "FREE")?.id).toBe("diamond");
    expect(lockedItem({ ...DEFAULT_CHARACTER, hat: "diamond" }, 1, "HOLDER")).toBeNull();
    expect(lockedItem(DEFAULT_CHARACTER, 1, "FREE")).toBeNull();
    expect(lockMessage(RARE_ITEMS[1])).toBe("Reach level 3 to use Gold wings.");
  });

  it("lists what a level-up unlocks", () => {
    expect(unlockedBetween(1, 3).map((i) => i.id)).toEqual(["aura", "goldwings"]);
    expect(unlockedBetween(3, 3)).toEqual([]);
  });
});
