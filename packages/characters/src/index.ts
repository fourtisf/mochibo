/*
 * @orbis/characters: the 3D chibi character engine ported from the prototype.
 * Framework-agnostic; React only wraps it. Safe to import during SSR (nothing
 * touches window/document until a function is called), but only call it in the browser.
 */
import { StageImpl } from "./stage";
import type { Stage, StageOptions } from "./types";

export type { Actor, ActorOptions, Stage, StageOptions } from "./types";
export { renderThumbnail, disposeThumbnailRenderer } from "./thumbnail";
export { isLowPowerDevice, setLowPower, getLowPower, hasWebGL } from "./quality";

/** Create a stage on a canvas. It joins the shared render loop until stage.dispose(). */
export function createStage(canvas: HTMLCanvasElement, options?: StageOptions): Stage {
  return new StageImpl(canvas, options);
}
