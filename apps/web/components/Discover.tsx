"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_COLOR,
  CHARACTER_BY_ID,
  ECONOMICS,
  SKILL_BY_ID,
  formatBps,
  normalizeCharacter,
  type CharacterConfig,
  type PublicAgent,
  type SkillCategory,
  type SkillId,
} from "@orbis/shared";
import { MARKET } from "@/lib/placeholder";
import { portraitUrl } from "@/lib/images";
import { StarIcon } from "@/lib/icons";
import { fmt, shortAddress } from "@/lib/format";
import { usePreview } from "@/lib/preview/store";
import { Portrait } from "./Portrait";
import { api, authActions, useAuth } from "@/lib/auth";
import { RunModal, type RunTarget } from "./RunModal";
import s from "./Discover.module.css";

interface Card {
  key: string;
  name: string;
  by: string;
  thumb: string;
  glow: string;
  config: CharacterConfig;
  cats: SkillCategory[];
  desc: string;
  skills: SkillId[];
  price: number;
  runs: number;
  rating: number | null;
  mine: boolean;
  /** Published agent id (real agents) or example id. */
  agentId?: string;
  exampleId?: string;
}

const catsOf = (skills: SkillId[]) => Array.from(new Set(skills.map((id) => SKILL_BY_ID[id].cat)));

/** Published agents from the API (GET /discover). Refetches when the visitor publishes or unpublishes. */
function usePublished(refreshKey: string) {
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  useEffect(() => {
    let live = true;
    api<{ agents: PublicAgent[] }>("/discover")
      .then((r) => live && setAgents(r.agents))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return agents;
}

export function Discover() {
  const { agents: mine } = usePreview();
  const auth = useAuth();
  const [filter, setFilter] = useState<string>("All");
  const [target, setTarget] = useState<RunTarget | null>(null);
  const openKey = useRef(0);
  const published = usePublished(mine.filter((a) => a.published).map((a) => `${a.id}:${a.price}`).join(","));

  const list: Card[] = useMemo(() => {
    const real: Card[] = published.map((a) => {
      const cfg = normalizeCharacter(a.character);
      const isMine = a.creator === auth.address;
      return {
        key: a.id,
        name: a.name,
        by: `${isMine ? "by you" : `by ${shortAddress(a.creator)}`} · Level ${a.level}`,
        thumb: a.thumbnailUrl || portraitUrl(CHARACTER_BY_ID[a.baseId] ? a.baseId : "juni"),
        glow: cfg.glow,
        config: cfg,
        cats: catsOf(a.skills),
        desc: a.skills.map((id) => SKILL_BY_ID[id].desc).join(" "),
        skills: a.skills,
        price: isMine ? ECONOMICS.runCostCr : a.price,
        runs: a.runsCount,
        rating: a.rating,
        mine: isMine,
        agentId: a.id,
      };
    });
    const examples: Card[] = MARKET.map((m) => ({
      key: m.id,
      name: m.name,
      by: `Example agent · ${m.by}`,
      thumb: portraitUrl(m.char),
      glow: CHARACTER_BY_ID[m.char].config.glow,
      config: CHARACTER_BY_ID[m.char].config,
      cats: [m.cat],
      desc: m.desc,
      skills: m.skills,
      price: m.price,
      runs: 0,
      rating: null,
      mine: false,
      exampleId: m.id,
    }));
    return [...real, ...examples];
  }, [published, auth.address]);

  const cats = useMemo(() => ["All", ...Array.from(new Set(list.flatMap((c) => c.cats)))], [list]);
  const signedOut = auth.status === "unauthenticated";

  const open = (c: Card) => {
    // Runs are paid with a wallet's credits: connect first.
    if (signedOut) {
      authActions.openSignIn();
      return;
    }
    openKey.current++;
    setTarget({
      key: openKey.current,
      name: c.name,
      desc: c.mine ? `Testing your own agent costs the same as a studio run (${ECONOMICS.runCostCr} CR).` : c.desc,
      skills: c.skills,
      price: c.price,
      thumb: c.thumb,
      glow: c.glow,
      character: c.config,
      lang: "English",
      tone: "Friendly",
      instructions: c.desc,
      agentId: c.agentId,
      exampleId: c.exampleId,
    });
  };

  return (
    <section id="discover">
      <div className="wrap">
        <div className={s.top}>
          <div className="head">
            <h2>Agents you can run today.</h2>
            <p>
              Run agents made by creators, or try the examples. Pay per run in credits. Creators keep the price minus a {formatBps(ECONOMICS.platformFeeBps)} fee.
            </p>
          </div>
          <div className={`seg ${s.filters}`}>
            {cats.map((c) => (
              <button key={c} aria-pressed={c === filter} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className={s.agents}>
          {list
            .filter((m) => filter === "All" || m.cats.includes(filter as SkillCategory))
            .map((m) => (
              <article className={s.ag} key={m.key}>
                <Portrait src={m.thumb} glow={m.glow}>
                  {m.mine && <span className={s.yours}>Yours</span>}
                  {m.exampleId ? (
                    <span className={s.rating}>Example</span>
                  ) : (
                    m.rating !== null && (
                      <span className={s.rating}>
                        <StarIcon />
                        {m.rating.toFixed(1)}
                      </span>
                    )
                  )}
                </Portrait>
                <div className={s.b}>
                  <h3>{m.name}</h3>
                  <div className={s.by}>{m.by}</div>
                  <p>{m.desc}</p>
                  <div className={s.tags}>
                    {m.skills.map((id) => (
                      <span className="pill" key={id}>
                        <i style={{ background: CATEGORY_COLOR[SKILL_BY_ID[id].cat] }} />
                        {SKILL_BY_ID[id].name}
                      </span>
                    ))}
                  </div>
                  <div className={s.f}>
                    <div className={s.price}>
                      {m.price} CR<small>{m.agentId ? `per run · ${fmt(m.runs)} runs` : "per run"}</small>
                    </div>
                    <button className={`btn ${m.mine ? "btn-glass" : "btn-primary"} btn-sm`} onClick={() => open(m)}>
                      {m.mine ? "Test it" : "Run"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>
      </div>
      <RunModal target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
