/** The 6 powers, in key order (keys 1 to 6). */
export const POWERS = [
  ["orb", "Orb"],
  ["shield", "Shield"],
  ["blink", "Blink"],
  ["levitate", "Levitate"],
  ["scan", "Scan"],
  ["hype", "Hype"],
] as const;
export type PowerName = (typeof POWERS)[number][0];

/** The 10 motions shown in the studio. */
export const MOTIONS = [
  ["wave", "Wave"],
  ["jump", "Jump"],
  ["dance", "Dance"],
  ["cheer", "Cheer"],
  ["spin", "Spin"],
  ["think", "Think"],
  ["nod", "Nod"],
  ["shrug", "Shrug"],
  ["point", "Point"],
  ["bow", "Bow"],
] as const;
export type MotionName = (typeof MOTIONS)[number][0];

/** The 6 expressions plus "talk", which the engine drives while an answer is typing. */
export const EXPRESSIONS = ["neutral", "happy", "love", "focus", "surprised", "talk"] as const;
export type Expression = (typeof EXPRESSIONS)[number];
