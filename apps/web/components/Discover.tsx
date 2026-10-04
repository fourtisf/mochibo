"use client";
import { useMemo, useRef, useState } from "react";
import { CATEGORY_COLOR, CHARACTER_BY_ID, ECONOMICS, SKILL_BY_ID, formatBps, type SkillCategory, type SkillId } from "@orbis/shared";
import { MARKET } from "@/lib/placeholder";
import { portraitUrl } from "@/lib/images";
import { StarIcon } from "@/lib/icons";
import { fmt } from "@/lib/format";
import { usePreview } from "@/lib/preview/store";
import { Portrait } from "./Portrait";
import { authActions, useAuth } from "@/lib/auth";
import { RunModal, type RunTarget } from "./RunModal";
import s from "./Discover.module.css";

interface Card {
  id: string;
  name: string;
  by: string;
  thumb: string;
  glow: string;
  cat?: SkillCategory;
  desc: string;
  skills: SkillId[];
  price: number;
  runs: number;
  rating: number;
  mine?: boolean;
}

export function Discover() {
  const { agent } = usePreview();
  const [filter, setFilter] = useState<string>("All");
  const [target, setTarget] = useState<RunTarget | null>(null);
  const openKey = useRef(0);

  const cats = useMemo(() => ["All", ...Array.from(new Set(MARKET.map((m) => m.cat)))], []);
  const list: Card[] = [];
  if (agent.published) {
    list.push({
      id: "mine",
      name: agent.name,
      by: "you",
      thumb: agent.thumb,
      glow: agent.cfg.glow,
      desc: "Your published agent. Others see the character and skills, not your instructions.",
      skills: agent.skills,
      price: agent.price,
      runs: agent.runs,
      rating: 5,
      mine: true,
    });
  }
  for (const m of MARKET) list.push({ ...m, thumb: portraitUrl(m.char), glow: CHARACTER_BY_ID[m.char].config.glow });

  const signedOut = useAuth().status === "unauthenticated";
  const open = (c: Card) => {
    // Runs are paid with a wallet's credits: connect first.
    if (signedOut) {
      authActions.openSignIn();
      return;
    }
    openKey.current++;
    setTarget(
      c.mine
        ? { key: openKey.current, name: agent.name, desc: "Testing your own agent costs the same as a studio run.", skills: agent.skills, price: ECONOMICS.runCostCr, thumb: agent.thumb, glow: agent.cfg.glow, lang: agent.lang, tone: agent.tone, instructions: agent.instructions }
        : { key: openKey.current, name: c.name, desc: c.desc, skills: c.skills, price: c.price, thumb: c.thumb, glow: c.glow, lang: "English", tone: "Friendly", instructions: c.desc, exampleId: c.id },
    );
  };

  return (
    <section id="discover">
      <div className="wrap">
        <div className={s.top}>
          <div className="head">
            <h2>Agents you can run today.</h2>
            <p>
              Example agents for the preview. Pay per run in credits. Creators keep the price minus a {formatBps(ECONOMICS.platformFeeBps)} fee.
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
            .filter((m) => filter === "All" || m.cat === filter || m.mine)
            .map((m) => (
              <article className={s.ag} key={m.id}>
                <Portrait src={m.thumb} glow={m.glow}>
                  {m.mine && <span className={s.yours}>Yours</span>}
                  {m.mine ? (
                    m.runs > 0 && (
                      <span className={s.rating}>
                        <StarIcon />
                        {m.rating.toFixed(1)}
                      </span>
                    )
                  ) : (
                    <span className={s.rating}>Example</span>
                  )}
                </Portrait>
                <div className={s.b}>
                  <h3>{m.name}</h3>
                  <div className={s.by}>{m.mine ? "by you" : `Example agent · ${m.by}`}</div>
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
                      {m.price} CR<small>{m.mine ? `${fmt(m.runs)} runs` : "per run"}</small>
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
