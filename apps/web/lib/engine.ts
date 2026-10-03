"use client";
/**
 * Lazy, client-only access to the 3D engine. Components that render a stage are themselves
 * loaded with next/dynamic({ ssr: false }); this helper is for code that only needs
 * renderThumbnail (bento, publish pane) so three.js never lands in the first-load bundle.
 */
type Engine = typeof import("@orbis/characters");

let p: Promise<Engine> | null = null;
export function loadEngine(): Promise<Engine> {
  if (!p) p = import("@orbis/characters");
  return p;
}
