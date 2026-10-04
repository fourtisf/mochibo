"use client";
/**
 * Studio state, saved to the signed-in wallet's account (CLAUDE.md 5.2).
 *
 * Signed out, the studio works on a local draft that is not saved. On sign-in the account's agents
 * load: the latest one opens, or, if the visitor already changed the draft, the draft is saved as a
 * new agent so nothing is lost. Every change autosaves with a 700 ms debounce (PATCH /agents/:id),
 * which drives the "Saving…" / "Saved" label. Publishing goes through the API with a portrait.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CHARACTERS,
  CHARACTER_BY_ID,
  ECONOMICS,
  TEMPLATES,
  type CharacterConfig,
  type Language,
  type OwnAgent,
  type SkillId,
  type Tone,
} from "@orbis/shared";
import { ApiError, api, useAuth } from "../auth";
import { loadEngine } from "../engine";

export interface StudioAgent {
  /** Server id, or null for the signed-out draft. */
  id: string | null;
  /** Public link id, set by the server. */
  slug: string | null;
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
  rating: number | null;
  /** Level points and level (rare items unlock by level). */
  xp: number;
  level: number;
  /** Portrait uploaded at publish time (URL), or "". */
  thumb: string;
}

export type SaveState = "Saved" | "Saving…" | "Sign in to save" | "Name needed" | "Not saved, retrying" | "Item locked";

interface PreviewStore {
  agent: StudioAgent;
  /** The account's agents (signed in only), newest first. */
  agents: OwnAgent[];
  saveState: SaveState;
  updateAgent(patch: Partial<StudioAgent>, opts?: { dirty?: boolean }): void;
  setCfg<K extends keyof CharacterConfig>(k: K, v: CharacterConfig[K]): void;
  replaceCfg(cfg: CharacterConfig): void;
  /** Change the price; a published agent's price is saved right away. */
  setPrice(price: number): void;
  /** Publish (with a fresh portrait) or unpublish. Returns an error message, or null on success. */
  publish(published: boolean): Promise<string | null>;
  openAgent(id: string): void;
  newAgent(): Promise<void>;
  deleteAgent(id: string): Promise<void>;
}

const juni = CHARACTER_BY_ID.juni;
const draftFor = (baseId: string): StudioAgent => {
  const c = CHARACTER_BY_ID[baseId] ?? juni;
  return {
    id: null,
    slug: null,
    baseId: c.id,
    role: c.role,
    cfg: { ...c.config },
    name: `My ${c.name}`,
    instructions: TEMPLATES[1].text,
    tone: "Friendly",
    lang: "English",
    skills: ["writer", "ideas", "research", "summary"],
    price: ECONOMICS.defaultPriceCr,
    published: false,
    runs: 0,
    earned: 0,
    rating: null,
    xp: 0,
    level: 1,
    thumb: "",
  };
};

export const fromOwn = (o: OwnAgent): StudioAgent => ({
  id: o.id,
  slug: o.slug,
  baseId: o.baseId,
  role: CHARACTER_BY_ID[o.baseId]?.role ?? "Custom",
  cfg: o.character,
  name: o.name,
  instructions: o.instructions,
  tone: o.tone,
  lang: o.lang,
  skills: o.skills,
  price: o.price,
  published: o.published,
  runs: o.runsCount,
  earned: o.earned,
  rating: o.rating,
  xp: o.xp,
  level: o.level,
  thumb: o.thumbnailUrl ?? "",
});

/** The fields autosave sends (price goes through publish). */
const savable = (a: StudioAgent) => ({ baseId: a.baseId, name: a.name.trim(), instructions: a.instructions, tone: a.tone, skills: a.skills, character: a.cfg });

const Ctx = createContext<PreviewStore | null>(null);

export function PreviewStoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [agent, setAgent] = useState<StudioAgent>(() => draftFor("juni"));
  const [agents, setAgents] = useState<OwnAgent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("Sign in to save");
  const latest = useRef(agent);
  latest.current = agent;
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const priceTimer = useRef<ReturnType<typeof setTimeout>>();
  /** True once the visitor changed the signed-out draft (it is saved as an agent at sign-in). */
  const draftTouched = useRef(false);
  const signedIn = auth.status === "authenticated";
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  const remember = useCallback((o: OwnAgent) => setAgents((list) => [o, ...list.filter((x) => x.id !== o.id)]), []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    clearTimeout(saveTimer.current);
    const a = latest.current;
    if (!a.id || !signedInRef.current) return false;
    if (!a.name.trim()) {
      setSaveState("Name needed");
      return false;
    }
    setSaveState("Saving…");
    try {
      const r = await api<{ agent: OwnAgent }>(`/agents/${a.id}`, { method: "PATCH", body: JSON.stringify(savable(a)) });
      remember(r.agent);
      // Only "Saved" if nothing changed while the request was in flight.
      if (latest.current === a) setSaveState("Saved");
      return true;
    } catch (e) {
      // A locked rare item will not save until the agent levels up: say so instead of retrying.
      if (e instanceof ApiError && e.code === "locked") {
        setSaveState("Item locked");
        return false;
      }
      setSaveState("Not saved, retrying");
      saveTimer.current = setTimeout(() => void saveNow(), 4000);
      return false;
    }
  }, [remember]);

  const markDirty = useCallback(() => {
    if (!signedInRef.current || !latest.current.id) {
      draftTouched.current = true;
      setSaveState("Sign in to save");
      return;
    }
    setSaveState("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNow(), 700);
  }, [saveNow]);

  // Sign-in: open the account's agents (or save the touched draft); sign-out: back to a local draft.
  useEffect(() => {
    if (auth.status === "unauthenticated") {
      clearTimeout(saveTimer.current);
      setAgents([]);
      setAgent((a) => (a.id ? draftFor(a.baseId) : a));
      setSaveState("Sign in to save");
      return;
    }
    if (auth.status !== "authenticated") return;
    let live = true;
    (async () => {
      try {
        const { agents: mine } = await api<{ agents: OwnAgent[] }>("/agents/mine");
        if (!live) return;
        if (mine.length && !draftTouched.current) {
          setAgents(mine);
          setAgent(fromOwn(mine[0]));
          setSaveState("Saved");
          return;
        }
        const d = latest.current;
        const r = await api<{ agent: OwnAgent }>("/agents", {
          method: "POST",
          body: JSON.stringify({ ...savable(d), name: d.name.trim() || "My agent", lang: d.lang, price: d.price }),
        });
        if (!live) return;
        draftTouched.current = false;
        setAgents([r.agent, ...mine]);
        setAgent(fromOwn(r.agent));
        setSaveState("Saved");
      } catch {
        if (live) setSaveState("Not saved, retrying");
      }
    })();
    return () => {
      live = false;
    };
  }, [auth.status, auth.address]);

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

  const setPrice = useCallback(
    (price: number) => {
      setAgent((a) => ({ ...a, price }));
      const a = latest.current;
      if (!a.id || !a.published) return;
      clearTimeout(priceTimer.current);
      priceTimer.current = setTimeout(async () => {
        const r = await api<{ agent: OwnAgent }>(`/agents/${a.id}/publish`, { method: "POST", body: JSON.stringify({ published: true, price }) }).catch(() => null);
        if (r) remember(r.agent);
      }, 500);
    },
    [remember],
  );

  const publish = useCallback(
    async (published: boolean): Promise<string | null> => {
      const a = latest.current;
      if (!a.id) return "Connect your wallet and sign in to publish.";
      if (published && !a.skills.length) return "Equip at least one skill before publishing.";
      if (!(await saveNow()) && published) return "Your latest changes could not be saved. Check the name, then try again.";
      try {
        let r = await api<{ agent: OwnAgent }>(`/agents/${a.id}/publish`, { method: "POST", body: JSON.stringify({ published, price: a.price }) });
        if (published) {
          // Portrait rendered once, here, and uploaded for Discover, the share page and link previews.
          const engine = await loadEngine();
          const image = engine.renderThumbnail(a.cfg, { type: "image/webp", quality: 0.9 });
          if (image) {
            const up = await api<{ agent: OwnAgent }>(`/agents/${a.id}/thumbnail`, { method: "POST", body: JSON.stringify({ image }) }).catch(() => null);
            if (up) r = up;
          }
        }
        remember(r.agent);
        setAgent((cur) => (cur.id === r.agent.id ? { ...cur, published: r.agent.published, slug: r.agent.slug, thumb: r.agent.thumbnailUrl ?? "" } : cur));
        return null;
      } catch {
        return published ? "Could not publish. Try again in a moment." : "Could not unpublish. Try again in a moment.";
      }
    },
    [remember, saveNow],
  );

  const openAgent = useCallback(
    (id: string) => {
      void saveNow();
      const o = agents.find((x) => x.id === id);
      if (o) {
        setAgent(fromOwn(o));
        setSaveState("Saved");
      }
    },
    [agents, saveNow],
  );

  const newAgent = useCallback(async () => {
    await saveNow();
    const base = CHARACTERS[agents.length % CHARACTERS.length];
    const d = draftFor(base.id);
    try {
      const r = await api<{ agent: OwnAgent }>("/agents", { method: "POST", body: JSON.stringify({ ...savable(d), lang: d.lang, price: d.price }) });
      setAgents((list) => [r.agent, ...list]);
      setAgent(fromOwn(r.agent));
      setSaveState("Saved");
    } catch {
      setSaveState("Not saved, retrying");
    }
  }, [agents.length, saveNow]);

  const deleteAgent = useCallback(
    async (id: string) => {
      await api(`/agents/${id}`, { method: "DELETE" });
      const rest = agents.filter((x) => x.id !== id);
      setAgents(rest);
      if (latest.current.id === id) {
        if (rest.length) setAgent(fromOwn(rest[0]));
        else {
          setAgent(draftFor("juni"));
          await newAgent();
        }
      }
    },
    [agents, newAgent],
  );

  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(priceTimer.current);
    },
    [],
  );

  const value = useMemo<PreviewStore>(
    () => ({ agent, agents, saveState, updateAgent, setCfg, replaceCfg, setPrice, publish, openAgent, newAgent, deleteAgent }),
    [agent, agents, saveState, updateAgent, setCfg, replaceCfg, setPrice, publish, openAgent, newAgent, deleteAgent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview must be used inside PreviewStoreProvider");
  return v;
}
