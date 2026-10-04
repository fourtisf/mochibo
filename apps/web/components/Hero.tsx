"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { APP_DISPLAY_HOST, CHARACTERS, ECONOMICS } from "@orbis/shared";
import { HERO_TASKS, MARKET } from "@/lib/placeholder";
import { useStats } from "@/lib/stats";
import { portraitUrl } from "@/lib/images";
import { isReducedMotion } from "@/lib/hooks";
import { PowerDock } from "./PowerDock";
import { ContractBadge } from "./ContractBadge";
import { Metrics } from "./Metrics";
import s from "./Hero.module.css";

const HeroStage = dynamic(() => import("./HeroStage"), { ssr: false });

const feeFactor = 1 - ECONOMICS.platformFeeBps / 10_000;

export function Hero() {
  const stats = useStats();
  const [idx, setIdx] = useState(0);
  const n = CHARACTERS.length;
  const c = CHARACTERS[idx];

  // Floating cards rotate every 3.8 s (placeholder content until phase 3).
  const [card, setCard] = useState({ i: 0, charIdx: 0 });
  const [swap, setSwap] = useState(false);
  const idxRef = useRef(idx);
  idxRef.current = idx;
  useEffect(() => {
    if (isReducedMotion()) return;
    let inner: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setSwap(true);
      inner = setTimeout(() => {
        setCard((c) => ({ i: c.i + 1, charIdx: (idxRef.current + c.i + 1) % n }));
        setSwap(false);
      }, 450);
    }, 3800);
    return () => {
      clearInterval(t);
      clearTimeout(inner);
    };
  }, [n]);

  const cardI = card.i;
  const cardChar = CHARACTERS[card.charIdx];
  const task = HERO_TASKS[cardI % HERO_TASKS.length];
  const earn = MARKET[cardI % MARKET.length];
  // Real recent payouts once there are any; illustrative examples until then.
  const recent = stats?.recent ?? [];
  const real = recent.length ? recent[cardI % recent.length] : null;
  const taskTitle = cardI === 0 ? "Juni is researching" : `${cardChar.name} ${task[0]}`;
  const earnFrom = real ? real.agent.name : cardI === 0 ? "Thread Smith" : earn.name;
  const earnVal = real ? real.earned.toFixed(2) : cardI === 0 ? "7.60" : (earn.price * feeFactor).toFixed(2);

  return (
    <section className={s.hero} id="top">
      <div className={`wrap ${s.head}`}>
        <a className={s.announce} href="#studio">
          <span className={s.pd} />
          Now live <b>Try the studio</b>
        </a>
        <h1>AI agents with a face, a wardrobe and a job.</h1>
        <p className={s.lede}>
          Design a 3D character, give it a personality and real skills, then run it, share it or publish it. Every time someone runs your agent, you earn.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href="#studio">
            Start building free
          </a>
          <a className="btn btn-glass" href="#discover">
            Explore agents
          </a>
        </div>
        <ContractBadge />
      </div>
      <div className="wrap">
        <div className={`win ${s.win}`}>
          <div className="win-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className={s.url}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {APP_DISPLAY_HOST}/discover
            </span>
            <span className="bar-right">
              <span className={s.live}>
                <i />
                Live 3D in your browser
              </span>
            </span>
          </div>
          <div className={s.body}>
            <HeroStage mode={{ kind: "lineup", idx }} label="Three live 3D characters. Drag to turn the middle one, tap any to say hi." />
            <div className={s.hint}>Drag to turn. Tap a character to say hi.</div>
            <div className={`${s.fcard} ${s.fcTask} glass${swap ? " " + s.swap : ""}`}>
              <div className={s.fcRow}>
                <div className={s.fcAv} style={{ background: cardChar.config.glow }}>
                  <img alt="" src={portraitUrl(cardChar.id)} />
                </div>
                <div>
                  <div className={s.fcT}>{taskTitle}</div>
                  <div className={s.fcS}>{task[1]}</div>
                </div>
              </div>
              <div className={s.bar}>
                <i />
              </div>
            </div>
            <div className={`${s.fcard} ${s.fcEarn} glass${swap ? " " + s.swap : ""}`}>
              <div className={s.fcS}>
                {real ? "Creator earned" : "Example payout"} · {earnFrom}
              </div>
              <div className={s.earnBig}>+{earnVal} CR</div>
              <svg className={s.spark} viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6EF0D2" stopOpacity=".35" />
                    <stop offset="1" stopColor="#6EF0D2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 30 L20 26 L40 28 L60 20 L80 22 L100 15 L120 17 L140 10 L160 12 L180 5 L200 3 L200 34 L0 34Z" fill="url(#sg)" />
                <path d="M0 30 L20 26 L40 28 L60 20 L80 22 L100 15 L120 17 L140 10 L160 12 L180 5 L200 3" fill="none" stroke="#6EF0D2" strokeWidth="2" />
              </svg>
            </div>
            <div className={s.cap}>
              <b>{c.name}</b>
              <span>{c.role}</span>
            </div>
            <div className={s.arrows}>
              <button className="ibtn glass" aria-label="Previous characters" onClick={() => setIdx((i) => (i - 1 + n) % n)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button className="ibtn glass" aria-label="Next characters" onClick={() => setIdx((i) => (i + 1) % n)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <PowerDock slot="hero" className={s.dock} />
          </div>
        </div>
      </div>
      <div className="wrap">
        <Metrics />
      </div>
    </section>
  );
}
