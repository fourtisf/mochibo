"use client";
/** Public page of a published agent (/a/[slug]): the character in 3D, who made it, its skills and a Run button. */
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { CATEGORY_COLOR, CHARACTER_BY_ID, ECONOMICS, SKILL_BY_ID, normalizeCharacter, type PublicAgent } from "@orbis/shared";
import { authActions, useAuth } from "@/lib/auth";
import { fmt, shortAddress } from "@/lib/format";
import { portraitUrl } from "@/lib/images";
import { StarIcon } from "@/lib/icons";
import { PowerDock } from "./PowerDock";
import { RunModal, type RunTarget } from "./RunModal";
import hero from "./Hero.module.css";
import s from "./AgentPage.module.css";

const HeroStage = dynamic(() => import("./HeroStage"), { ssr: false });

export function AgentPage({ agent }: { agent: PublicAgent }) {
  const auth = useAuth();
  const [target, setTarget] = useState<RunTarget | null>(null);
  const key = useRef(0);
  const cfg = normalizeCharacter(agent.character);
  const mine = auth.address === agent.creator;
  const price = mine ? ECONOMICS.runCostCr : agent.price;
  const role = CHARACTER_BY_ID[agent.baseId]?.role ?? "Agent";

  const open = () => {
    if (auth.status !== "authenticated") {
      authActions.openSignIn();
      return;
    }
    key.current++;
    setTarget({
      key: key.current,
      name: agent.name,
      desc: agent.skills.map((id) => SKILL_BY_ID[id].desc).join(" "),
      skills: agent.skills,
      price,
      thumb: agent.thumbnailUrl || portraitUrl(CHARACTER_BY_ID[agent.baseId] ? agent.baseId : "juni"),
      glow: cfg.glow,
      lang: "English",
      tone: "Friendly",
      instructions: "",
      agentId: agent.id,
    });
  };

  return (
    <main className={`wrap ${s.page}`}>
      <div className={`win ${s.stage}`}>
        <div className="win-bar">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span className="bar-right">
            <span className={hero.live}>
              <i />
              Live 3D
            </span>
          </span>
        </div>
        <div className={`${hero.body} ${s.body}`}>
          <HeroStage mode={{ kind: "single", config: cfg }} label={`${agent.name} in 3D. Drag to turn it, tap to say hi.`} />
          <PowerDock slot="hero" className={hero.dock} />
        </div>
      </div>
      <section className={s.info}>
        <span className="pill">{role}</span>
        <h1>{agent.name}</h1>
        <p className={s.by}>
          by {mine ? "you" : shortAddress(agent.creator)}
          {agent.rating !== null && (
            <span className={s.rating}>
              <StarIcon /> {agent.rating.toFixed(1)} <small>({fmt(agent.ratingCount)})</small>
            </span>
          )}
        </p>
        <div className={s.skills}>
          {agent.skills.map((id) => (
            <div className={s.skill} key={id}>
              <b>
                <i style={{ background: CATEGORY_COLOR[SKILL_BY_ID[id].cat] }} />
                {SKILL_BY_ID[id].name}
              </b>
              <span>{SKILL_BY_ID[id].desc}</span>
            </div>
          ))}
        </div>
        <div className={s.buy}>
          <div>
            <b>{price} CR</b>
            <small>per run · {fmt(agent.runsCount)} runs</small>
          </div>
          <button className="btn btn-primary" onClick={open}>
            {auth.status === "unauthenticated" ? "Connect wallet to run" : "Run this agent"}
          </button>
        </div>
        <p className={s.note}>
          {mine
            ? `This is your agent. Running it yourself costs a studio run (${ECONOMICS.runCostCr} CR).`
            : "New wallets get free credits. The creator earns from every run. Failed runs are refunded."}
        </p>
        <a className={`btn btn-glass ${s.build}`} href="/#studio">
          Build your own agent
        </a>
      </section>
      <RunModal target={target} onClose={() => setTarget(null)} />
    </main>
  );
}
