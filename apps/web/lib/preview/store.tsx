"use client";
/**
 * PREVIEW STATE (phase 1).
 * Credits, the ledger, the wallet and the studio agent live in browser memory here, exactly
 * like the prototype, minus its fake incoming runs after publishing. Phase 2 swaps this for SIWE + the agents API (autosave via PATCH),
 * phase 3 for the real ledger. Components only talk to the hooks below, so the swap stays
 * inside this file.
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

export interface LedgerItem {
  id: number;
  time: string;
  text: string;
  amt: number;
}

type SaveState = "Saved" | "Saving…";

interface PreviewStore {
  credits: number;
  wallet: string | null;
  ledger: LedgerItem[];
  agent: StudioAgent;
  saveState: SaveState;
  updateAgent(patch: Partial<StudioAgent>, opts?: { dirty?: boolean }): void;
  setCfg<K extends keyof CharacterConfig>(k: K, v: CharacterConfig[K]): void;
  replaceCfg(cfg: CharacterConfig): void;
  addCredits(amount: number): void;
  /** Debit a run. Returns false (and changes nothing) when the balance is too low. */
  spend(cost: number, ledgerText: string): boolean;
  addLedger(text: string, amt: number): void;
  setPublished(published: boolean, thumb?: string): void;
  toggleWallet(): string | null;
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

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function PreviewStoreProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(500);
  const [wallet, setWallet] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [agent, setAgent] = useState<StudioAgent>(INITIAL_AGENT);
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const ledgerId = useRef(0);
  const creditsRef = useRef(credits);
  creditsRef.current = credits;

  // Phase 2: replace with a debounced PATCH /agents/:id.
  const markDirty = useCallback(() => {
    setSaveState("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState("Saved"), 700);
  }, []);

  const addLedger = useCallback((text: string, amt: number) => {
    const item = { id: ++ledgerId.current, time: nowTime(), text, amt };
    setLedger((l) => [item, ...l].slice(0, 10));
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

  const addCredits = useCallback(
    (v: number) => {
      setCredits((c) => c + v);
      addLedger("Added preview credits", v);
    },
    [addLedger],
  );

  const spend = useCallback(
    (cost: number, text: string) => {
      if (creditsRef.current < cost) return false;
      creditsRef.current -= cost;
      setCredits((c) => c - cost);
      if (cost) addLedger(text, -cost);
      return true;
    },
    [addLedger],
  );

  const setPublished = useCallback(
    (published: boolean, thumb?: string) => {
      setAgent((a) => ({ ...a, published, thumb: thumb ?? a.thumb }));
    },
    [],
  );

  const toggleWallet = useCallback(() => {
    // Mock connect. Phase 2: wagmi + Sign-In with Ethereum on Robinhood Chain.
    if (wallet) {
      setWallet(null);
      return null;
    }
    let a = "0x";
    for (let i = 0; i < 40; i++) a += "0123456789abcdef"[Math.floor(Math.random() * 16)];
    setWallet(a);
    return a;
  }, [wallet]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const value = useMemo<PreviewStore>(
    () => ({ credits, wallet, ledger, agent, saveState, updateAgent, setCfg, replaceCfg, addCredits, spend, addLedger, setPublished, toggleWallet }),
    [credits, wallet, ledger, agent, saveState, updateAgent, setCfg, replaceCfg, addCredits, spend, addLedger, setPublished, toggleWallet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview must be used inside PreviewStoreProvider");
  return v;
}
