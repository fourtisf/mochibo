"use client";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { POWERS } from "@orbis/shared";
import type { Stage } from "@orbis/characters";

type Slot = "hero" | "studio";

interface Registry {
  get(slot: Slot): Stage | null;
  set(slot: Slot, stage: Stage | null): void;
}

const Ctx = createContext<Registry>({ get: () => null, set: () => {} });

/**
 * Keeps a handle to the hero and studio stages so the power docks and the 1 to 6 keys can
 * reach them. Like the prototype, keys drive the studio stage when it is on screen,
 * otherwise the hero.
 */
export function StageRegistryProvider({ children }: { children: ReactNode }) {
  const stages = useRef<Record<Slot, Stage | null>>({ hero: null, studio: null });
  const reg = useMemo<Registry>(
    () => ({
      get: (s) => stages.current[s],
      set: (s, st) => {
        stages.current[s] = st;
      },
    }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (!(n >= 1 && n <= 6)) return;
      const { hero, studio } = stages.current;
      const target = studio && studio.visible ? studio : hero;
      target?.power(POWERS[n - 1][0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <Ctx.Provider value={reg}>{children}</Ctx.Provider>;
}

export const useStages = () => useContext(Ctx);
