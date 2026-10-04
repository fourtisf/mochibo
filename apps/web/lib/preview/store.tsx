"use client";
/**
 * PREVIEW STATE. The studio agent lives in browser memory here, like the prototype. Credits are
 * real and live on the server (lib/account.ts). Phase 2 swaps this file for the agents API
 * (autosave via PATCH); components only talk to the hooks below, so the swap stays here.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CHARACTER_BY_ID,
  ECONOMICS,
  TEMPLATES,
  type CharacterConfig,
  type Language,
  type SkillId,
  type Tone,
} from "@orbis/shared";

export interface StudioAgent {
  /** Base character the look started from (selected in the roster). */
  baseId: string;
  role: string;
  cfg: CharacterConfig;
  name: string;
  instructions: string;
  tone: Tone;
  lang: Language;
  skills: SkillId[];
  price: number;
  published: boolean;
  runs: number;
  earned: number;
  /** Portrait rendered once at publish time. */
  thumb: string;
}

type SaveState = "Saved" | "Saving…";

interface PreviewStore {
  agent: StudioAgent;
  saveState: SaveState;
  updateAgent(patch: Partial<StudioAgent>, opts?: { dirty?: boolean }): void;
  setCfg<K extends keyof CharacterConfig>(k: K, v: CharacterConfig[K]): void;
  replaceCfg(cfg: CharacterConfig): void;
  setPublished(published: boolean, thumb?: string): void;
}

const juni = CHARACTER_BY_ID.juni;
const INITIAL_AGENT: StudioAgent = {
  baseId: juni.id,
  role: juni.role,
  cfg: { ...juni.config },
  name: "My Juni",
  instructions: TEMPLATES[1].text,
  tone: "Friendly",
  lang: "English",
  skills: ["writer", "ideas", "research", "summary"],
  price: ECONOMICS.defaultPriceCr,
  published: false,
  runs: 0,
  earned: 0,
  thumb: "",
};

const Ctx = createContext<PreviewStore | null>(null);

export function PreviewStoreProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<StudioAgent>(INITIAL_AGENT);
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Phase 2: replace with a debounced PATCH /agents/:id.
  const markDirty = useCallback(() => {
    setSaveState("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState("Saved"), 700);
  }, []);

  const updateAgent = useCallback(
    (patch: Partial<StudioAgent>, opts?: { dirty?: boolean }) => {
      setAgent((a) => ({ ...a, ...patch }));
      if (opts?.dirty !== false) markDirty();
    },
    [markDirty],
  );

  const setCfg = useCallback(
    <K extends keyof CharacterConfig>(k: K, v: CharacterConfig[K]) => {
      setAgent((a) => ({ ...a, cfg: { ...a.cfg, [k]: v } }));
      markDirty();
    },
    [markDirty],
  );

  const replaceCfg = useCallback(
    (cfg: CharacterConfig) => {
      setAgent((a) => ({ ...a, cfg }));
      markDirty();
    },
    [markDirty],
  );

  const setPublished = useCallback(
    (published: boolean, thumb?: string) => {
      setAgent((a) => ({ ...a, published, thumb: thumb ?? a.thumb }));
    },
    [],
  );

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const value = useMemo<PreviewStore>(
    () => ({ agent, saveState, updateAgent, setCfg, replaceCfg, setPublished }),
    [agent, saveState, updateAgent, setCfg, replaceCfg, setPublished],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview must be used inside PreviewStoreProvider");
  return v;
}
