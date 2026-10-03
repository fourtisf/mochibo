/* Public engine types. */
import type { CharacterConfig, Expression, MotionName, PowerName } from "@orbis/shared";

export interface StageOptions {
  /** Half the visible width in world units, or a function of the canvas aspect ratio. Default 1.05. */
  halfW?: number | ((aspect: number) => number);
  /** Half the visible height in world units. Default 1.15. */
  halfH?: number;
  /** Camera height. Default 1.05. */
  camY?: number;
  /** Camera look-at height. Default 0.95. */
  lookY?: number;
  /** Low-power rendering. Default: getLowPower(). */
  lowPower?: boolean;
  /** Called after a tapped actor plays its random reaction. */
  onTap?: (actor: Actor, stage: Stage) => void;
}

export interface ActorOptions {
  x?: number;
  z?: number;
  rot?: number;
  scale?: number;
  main?: boolean;
}

export interface Actor {
  readonly config: CharacterConfig;
  /** Rebuild the character with a new config and recolor the pedestal rings. */
  setConfig(config: CharacterConfig): void;
  play(motion: MotionName): void;
  /** True while a motion is in progress. */
  readonly isPlaying: boolean;
  setExpression(expr: Expression, durationSec?: number): void;
  /** While true (and no timed expression is active) the face uses the "talk" expression. */
  talking: boolean;
}

export interface Stage {
  readonly canvas: HTMLCanvasElement;
  readonly actors: readonly Actor[];
  readonly main: Actor | null;
  /** From an IntersectionObserver (rootMargin 120px). Hidden stages skip rendering. */
  readonly visible: boolean;
  /** Camera distance multiplier. The caller clamps it (the prototype uses 0.55 to 1.3). */
  zoom: number;
  addActor(config: CharacterConfig, opts?: ActorOptions): Actor;
  /** Remove all actors and end running effects. */
  clear(): void;
  power(name: PowerName): void;
  /** Render a frame and return it as a data URL. */
  snapshot(type?: "image/png" | "image/webp"): string;
  dispose(): void;
}
