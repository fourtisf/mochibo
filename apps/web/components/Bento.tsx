"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLOR, CHARACTER_BY_ID, POWERS, SKILLS, type CharacterConfig } from "@orbis/shared";
import { BENTO_EARN } from "@/lib/placeholder";
import { PowerIcon } from "@/lib/icons";
import { fullBodyUrl } from "@/lib/images";
import { loadEngine } from "@/lib/engine";
import { sparkPath } from "@/lib/format";
import { countUp } from "@/lib/countup";
import { copyText, isReducedMotion } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { useShareLinks } from "@/lib/share";
import s from "./Bento.module.css";

type BentoKey = "topC" | "hairC" | "eyeC";
const PICK: Record<BentoKey, string[]> = {
  topC: ["#8B7CFF", "#6EF0D2", "#FF8FB8", "#FFE27A", "#F5F3FF"],
  hairC: ["#FF8FB8", "#2A1B12", "#CFC6FF", "#FFE27A", "#6EF0D2"],
  eyeC: ["#7C5CFF", "#3FA7FF", "#2E9C7E", "#FF8FB8", "#FFB38A"],
};
const HATS = [
  ["none", "None"],
  ["beanie", "Beanie"],
  ["catears", "Cat ears"],
  ["halo", "Halo"],
] as const;
const ROWS: [BentoKey, string][] = [
  ["topC", "Hoodie"],
  ["hairC", "Hair"],
  ["eyeC", "Eyes"],
];
const TYPER_TEXT = "Write like a friendly founder. Short sentences, no hype words. Give two versions when tone matters, and never invent numbers.";

const juni = CHARACTER_BY_ID.juni;

export function Bento() {
  const toast = useToast();
  const { shareLink, shareShort } = useShareLinks();
  const [cfg, setCfg] = useState<CharacterConfig>({ ...juni.config });
  // Start from the pre-rendered image; re-render client-side once the user changes the look.
  const [img, setImg] = useState(fullBodyUrl(juni.id));
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    let live = true;
    loadEngine().then((e) => {
      const url = e.renderThumbnail(cfg, { full: true });
      if (live && url) setImg(url);
    });
    return () => {
      live = false;
    };
  }, [cfg]);

  const pick = (k: BentoKey, v: string) => {
    touched.current = true;
    setCfg((c) => ({ ...c, [k]: v, ...(k === "topC" ? { glow: v === "#F5F3FF" ? "#CFC6FF" : v } : {}) }));
  };

  // Typewriter and earnings count-up start when the tile scrolls into view.
  const typerRef = useRef<HTMLSpanElement>(null);
  const earnRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = typerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    let stop = () => {};
    let started = false;
    const obs = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting || started) return;
      started = true;
      obs.disconnect();
      if (isReducedMotion()) {
        el.textContent = TYPER_TEXT;
        return;
      }
      let i = 0;
      const step = () => {
        i++;
        el.textContent = TYPER_TEXT.slice(0, i);
        if (i < TYPER_TEXT.length) timer = setTimeout(step, 28);
      };
      step();
      if (earnRef.current) stop = countUp(earnRef.current, BENTO_EARN.total, 0);
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(timer);
      stop();
    };
  }, []);

  const W = 300;
  const H = 90;
  const p = sparkPath(BENTO_EARN.series, W, H, 8);

  return (
    <section id="features">
      <div className="wrap">
        <div className="head center">
          <h2>Everything an agent needs, in one studio.</h2>
          <p>A look people remember, a mind that follows your rules, and skills that get work done. Then a marketplace that pays you for it.</p>
        </div>
        <div className={s.bento}>
          <div className={`${s.tile} ${s.dress}`}>
            <div className={s.dressTop}>
              <h3>Dress every piece</h3>
              <p>Hair, eyes, outfits, hats, glasses, wings and a little buddy. Pick any color and the character updates instantly.</p>
            </div>
            <div className={s.dressStage}>
              <div
                className={s.portrait}
                style={{ background: `radial-gradient(90% 70% at 50% 100%, ${cfg.glow}59, transparent 70%), linear-gradient(180deg,#241D52,#18133D)` }}
              >
                <img alt="Juni in the outfit you picked" src={img} />
              </div>
              <div className={s.controls}>
                {ROWS.map(([k, label]) => (
                  <div key={k}>
                    <div className={s.clbl}>{label}</div>
                    <div className="sws">
                      {PICK[k].map((c) => (
                        <button key={c} className="sw" style={{ background: c }} aria-label={`${k} ${c}`} aria-pressed={c === cfg[k]} onClick={() => pick(k, c)} />
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <div className={s.clbl}>Hat</div>
                  <div className="chips">
                    {HATS.map(([v, n]) => (
                      <button
                        key={v}
                        className="chip"
                        aria-pressed={v === cfg.hat}
                        onClick={() => {
                          touched.current = true;
                          setCfg((c) => ({ ...c, hat: v }));
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${s.tile} ${s.wide}`}>
            <h3>A mind that follows your rules</h3>
            <p>Write instructions once. They go with every run, and nobody else can read them.</p>
            <div className={s.typer}>
              <span ref={typerRef} />
              <span className={s.caret} />
            </div>
            <div className={s.toneRow}>
              <span className="pill">Friendly</span>
              <span className="pill">English or Indonesian</span>
              <span className="pill">2,000 characters</span>
            </div>
          </div>

          <div className={s.tile}>
            <h3>Eight working skills</h3>
            <p>Equip up to four per agent.</p>
            <div className={s.cloud}>
              {SKILLS.map((sk) => (
                <span className="pill" key={sk.id}>
                  <i style={{ background: CATEGORY_COLOR[sk.cat] }} />
                  {sk.name}
                </span>
              ))}
            </div>
          </div>

          <div className={s.tile}>
            <h3>Earn on every run</h3>
            <p>Set a price. Get paid in credits.</p>
            <div className={s.earnNum}>
              <span ref={earnRef}>0</span> CR<small>this week</small>
            </div>
            <svg className={s.earnChart} viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8B7CFF" stopOpacity=".45" />
                  <stop offset="1" stopColor="#8B7CFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${p} L${W} ${H} L0 ${H}Z`} fill="url(#eg)" />
              <path d={p} fill="none" stroke="#A99DFF" strokeWidth="2.2" />
            </svg>
          </div>

          <div className={`${s.tile} ${s.wide}`}>
            <h3>Share it as a link or put it on any page</h3>
            <p>Your whole agent fits in one link. Drop a live preview into a site with one line of code.</p>
            <div className={s.sharePill}>
              <span>{shareShort}</span>
              <button
                className="btn btn-glass btn-xs"
                onClick={async () => {
                  await copyText(shareLink);
                  toast("Copied");
                }}
              >
                Copy link
              </button>
            </div>
          </div>

          <div className={`${s.tile} ${s.wide}`}>
            <h3>Six powers, one key each</h3>
            <p>Press 1 to 6 anywhere on the page to watch them in action.</p>
            <div className={s.pgrid}>
              {POWERS.map(([k, n], i) => (
                <div key={k}>
                  <PowerIcon name={k} />
                  <span>
                    {i + 1} {n}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
