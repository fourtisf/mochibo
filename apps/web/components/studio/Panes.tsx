"use client";
import { useEffect, useState } from "react";
import {
  CHARACTERS,
  CHIPS,
  ECONOMICS,
  LIMITS,
  PALETTES,
  SKILLS,
  SKILL_BY_ID,
  TEMPLATES,
  TONES,
  formatBps,
  type CharacterConfig,
  type ColorKey,
} from "@orbis/shared";
import { Portrait } from "@/components/Portrait";
import { portraitUrl } from "@/lib/images";
import { loadEngine } from "@/lib/engine";
import { fmt, rnd } from "@/lib/format";
import { copyText } from "@/lib/hooks";
import { usePreview } from "@/lib/preview/store";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { useShareLinks } from "@/lib/share";
import { useStages } from "@/lib/stages";
import { useToast } from "@/lib/toast";
import { Chips, Swatches } from "./controls";
import s from "./Studio.module.css";

function PaneHead({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <>
      <div className={s.paneH}>{title}</div>
      <div className={s.paneS}>{sub}</div>
    </>
  );
}

export function CharacterPane() {
  const { agent, updateAgent } = usePreview();
  const stages = useStages();
  return (
    <>
      <PaneHead title="Choose a character" sub="Everything you change later is saved with your agent." />
      <div className={s.roster}>
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            className={s.ro}
            aria-pressed={agent.baseId === c.id}
            onClick={() => {
              const wasDefault = /^My /.test(agent.name);
              updateAgent({ baseId: c.id, role: c.role, cfg: { ...c.config }, ...(wasDefault ? { name: `My ${c.name}` } : {}) });
              stages.get("studio")?.main?.play("wave");
            }}
          >
            <Portrait src={portraitUrl(c.id)} glow={c.config.glow} />
            <b>{c.name}</b>
            <span>{c.role}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function StylePane() {
  const { agent, setCfg } = usePreview();
  const c = agent.cfg;
  const bot = c.kind === "bot";
  const sw = (k: ColorKey) => <Swatches k={k} value={c[k]} onPick={(v) => setCfg(k, v)} />;
  return (
    <>
      <PaneHead title="Style" sub="Tap a swatch or use the wheel for any color." />
      {!bot && (
        <div>
          <div className="field">
            <div className="lbl">Skin</div>
            {sw("skin")}
          </div>
          <div className="field">
            <div className="lbl">Hair</div>
            <div className="chips">
              <Chips k="hair" value={c.hair} onPick={(v) => setCfg("hair", v as CharacterConfig["hair"])} />
            </div>
          </div>
          <div className="field">
            <div className="lbl">Hair color</div>
            {sw("hairC")}
          </div>
          <div className="field">
            <div className="lbl">Eyes</div>
            {sw("eyeC")}
          </div>
          <div className="field">
            <div className="lbl">Face</div>
            <div className="chips">
              <Chips k="mouth" value={c.mouth} onPick={(v) => setCfg("mouth", v as CharacterConfig["mouth"])} />
              {(["blush", "freckles", "lashes"] as const).map((k) => (
                <button key={k} className="chip" aria-pressed={c[k]} onClick={() => setCfg(k, !c[k])}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="lbl">Outfit</div>
            <div className="chips">
              <Chips k="top" value={c.top} onPick={(v) => setCfg("top", v as CharacterConfig["top"])} />
            </div>
          </div>
        </div>
      )}
      {bot && (
        <div>
          <div className="field">
            <div className="lbl">Movement</div>
            <div className="chips">
              <Chips k="legs" value={c.legs} onPick={(v) => setCfg("legs", v as CharacterConfig["legs"])} />
            </div>
          </div>
        </div>
      )}
      <div className="field">
        <div className="lbl">{bot ? "Body" : c.top === "overalls" ? "Shirt" : "Top"}</div>
        {sw("topC")}
      </div>
      <div className="field">
        <div className="lbl">{bot ? "Accent and joints" : c.top === "overalls" ? "Overalls" : "Bottoms"}</div>
        {sw("bottomC")}
      </div>
      <div className="field">
        <div className="lbl">Shoes</div>
        {sw("shoeC")}
      </div>
    </>
  );
}

function randomLook(c: CharacterConfig): CharacterConfig {
  const n: CharacterConfig = { ...c };
  if (n.kind === "human") {
    n.skin = rnd(PALETTES.skin);
    n.hair = rnd(CHIPS.hair)[0];
    n.hairC = rnd(PALETTES.hairC);
    n.eyeC = rnd(PALETTES.eyeC);
    n.top = rnd(CHIPS.top)[0];
    n.glasses = rnd(["none", "none", "round", "shades"] as const);
    n.hat = rnd(["none", "none", "beanie", "cap", "catears", "halo", "headphones"] as const);
    n.blush = Math.random() > 0.2;
    n.freckles = Math.random() > 0.7;
    n.lashes = Math.random() > 0.5;
    n.mouth = rnd(["smile", "smile", "cat"] as const);
  } else {
    n.hat = rnd(["none", "catears", "halo", "headphones"] as const);
    n.legs = rnd(["legs", "hover"] as const);
  }
  n.topC = rnd(PALETTES.topC);
  n.bottomC = rnd(PALETTES.bottomC);
  n.shoeC = rnd(PALETTES.shoeC);
  n.accC = rnd(PALETTES.accC);
  n.glow = rnd(PALETTES.glow);
  n.back = rnd(CHIPS.back)[0];
  n.buddy = Math.random() > 0.6;
  return n;
}

export function GearPane() {
  const { agent, setCfg, replaceCfg } = usePreview();
  const stages = useStages();
  const c = agent.cfg;
  const bot = c.kind === "bot";
  return (
    <>
      <PaneHead title="Gear" sub="Accessories, a companion and the glow color." />
      <div className="field">
        <div className="lbl">Head</div>
        <div className="chips">
          <Chips k="hat" value={c.hat} hideHumanOnly={bot} onPick={(v) => setCfg("hat", v as CharacterConfig["hat"])} />
        </div>
      </div>
      {!bot && (
        <div className="field">
          <div className="lbl">Glasses</div>
          <div className="chips">
            <Chips k="glasses" value={c.glasses} onPick={(v) => setCfg("glasses", v as CharacterConfig["glasses"])} />
          </div>
        </div>
      )}
      <div className="field">
        <div className="lbl">Back</div>
        <div className="chips">
          <Chips k="back" value={c.back} onPick={(v) => setCfg("back", v as CharacterConfig["back"])} />
        </div>
      </div>
      <div className="field">
        <div className="lbl">Buddy</div>
        <div className="chips">
          <Chips k="buddy" value={c.buddy ? "on" : "off"} onPick={(v) => setCfg("buddy", v === "on")} />
        </div>
      </div>
      <div className="field">
        <div className="lbl">Accessory color</div>
        <Swatches k="accC" value={c.accC} onPick={(v) => setCfg("accC", v)} />
      </div>
      <div className="field">
        <div className="lbl">Glow</div>
        <Swatches k="glow" value={c.glow} onPick={(v) => setCfg("glow", v)} />
      </div>
      <button
        className="btn btn-glass btn-sm"
        onClick={() => {
          replaceCfg(randomLook(c));
          stages.get("studio")?.main?.play("spin");
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
        Randomize look
      </button>
    </>
  );
}

export function MindPane() {
  const { agent, updateAgent } = usePreview();
  const toast = useToast();
  // The field can be empty while typing; the agent falls back to "Untitled agent" like the prototype.
  const [nameDraft, setNameDraft] = useState(agent.name);
  useEffect(() => {
    setNameDraft((d) => ((d || "Untitled agent") === agent.name ? d : agent.name));
  }, [agent.name]);
  return (
    <>
      <PaneHead title="Mind" sub="How your agent thinks and talks." />
      <div className="field">
        <label className="lbl" htmlFor="pName">
          Name
        </label>
        <input
          className="input"
          id="pName"
          maxLength={LIMITS.nameMax}
          value={nameDraft}
          onChange={(e) => {
            setNameDraft(e.target.value);
            updateAgent({ name: e.target.value || "Untitled agent" });
          }}
        />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="pInstr">
          Instructions{" "}
          <small>
            {fmt(agent.instructions.length)} / {fmt(LIMITS.instructionsMax)}
          </small>
        </label>
        <textarea className="input" id="pInstr" maxLength={LIMITS.instructionsMax} value={agent.instructions} onChange={(e) => updateAgent({ instructions: e.target.value })} />
      </div>
      <div className="field">
        <div className="lbl">Tone</div>
        <div className="seg">
          {TONES.map((t) => (
            <button key={t} aria-pressed={agent.tone === t} onClick={() => updateAgent({ tone: t })}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="lbl">Start from a template</div>
        <div className={s.tpls}>
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              className={s.tpl}
              onClick={() => {
                updateAgent({ instructions: t.text, skills: [...t.skills] });
                toast(`${t.name} applied`);
              }}
            >
              <b>{t.name}</b>
              {t.skills.length} skills
            </button>
          ))}
        </div>
      </div>
      <p className="note">People who run your published agent never see these instructions.</p>
    </>
  );
}

export function SkillsPane() {
  const { agent, updateAgent } = usePreview();
  const toast = useToast();
  const sk = agent.skills;
  return (
    <>
      <PaneHead title="Skills" sub={`${sk.length} of ${LIMITS.skillsMax} equipped`} />
      <div className={s.skillList}>
        {SKILLS.map((x) => (
          <button
            key={x.id}
            className={s.skill}
            aria-pressed={sk.includes(x.id)}
            onClick={() => {
              if (sk.includes(x.id)) updateAgent({ skills: sk.filter((i) => i !== x.id) });
              else if (sk.length >= LIMITS.skillsMax) toast("Four skills max. Remove one first.");
              else updateAgent({ skills: [...sk, x.id] });
            }}
          >
            <span className={s.box}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F2A24" strokeWidth="3.4" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span>
              <b>{x.name}</b>
              <span className={s.desc}>{x.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

const LEDGER_LABEL: Record<string, string> = { WELCOME: "Welcome credits", RUN_DEBIT: "Run", REFUND: "Refund", RUN_CREDIT: "Earned", TOPUP: "Top-up" };

export function PublishPane({ active }: { active: boolean }) {
  const { agent, updateAgent, setPublished } = usePreview();
  const { ledger } = useAccount();
  const { status } = useAuth();
  const { shareLink, embedCode } = useShareLinks();
  const stages = useStages();
  const toast = useToast();
  const [liveThumb, setLiveThumb] = useState("");

  // Portrait of the current look, rendered client-side while this pane is open.
  useEffect(() => {
    if (!active || (agent.published && agent.thumb)) return;
    let live = true;
    const t = setTimeout(() => {
      loadEngine().then((e) => {
        const url = e.renderThumbnail(agent.cfg);
        if (live) setLiveThumb(url);
      });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, agent.cfg, agent.published, agent.thumb]);

  const togglePublish = async () => {
    if (!agent.published && !agent.skills.length) return toast("Equip at least one skill before publishing.");
    if (agent.published) {
      setPublished(false);
      toast("Unpublished");
      return;
    }
    // Phase 2: POST /agents/:id/publish, then upload this portrait to /agents/:id/thumbnail.
    const e = await loadEngine();
    setPublished(true, e.renderThumbnail(agent.cfg));
    toast("Published to Discover");
    stages.get("studio")?.power("hype");
  };

  const thumb = agent.published && agent.thumb ? agent.thumb : liveThumb;
  return (
    <>
      <PaneHead title="Publish" sub="Put your agent in Discover and earn every time it runs." />
      <div className={s.pub}>
        <Portrait src={thumb} glow={agent.cfg.glow} />
        <div>
          <b>{agent.name}</b>
          <span className={s.sub}>{agent.skills.map((id) => SKILL_BY_ID[id].name).join(", ") || "No skills yet"}</span>
          <span className={`${s.status}${agent.published ? " " + s.on : ""}`}>{agent.published ? "Live in Discover" : "Draft"}</span>
        </div>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="price">
          Price per run{" "}
          <small>
            <span>{agent.price}</span> CR
          </small>
        </label>
        <input
          type="range"
          id="price"
          min={LIMITS.priceMin}
          max={LIMITS.priceMax}
          value={agent.price}
          onChange={(e) => updateAgent({ price: +e.target.value }, { dirty: false })}
        />
      </div>
      <button className={`btn ${agent.published ? "btn-glass" : "btn-primary"} btn-block`} onClick={togglePublish}>
        {agent.published ? "Unpublish" : "Publish to Discover"}
      </button>
      <div className={s.stats}>
        <div className={s.stat}>
          <small>Runs</small>
          <b>{fmt(agent.runs)}</b>
        </div>
        <div className={s.stat}>
          <small>Earned</small>
          <b>{fmt(agent.earned)}</b>
        </div>
        <div className={s.stat}>
          <small>Fee</small>
          <b>{formatBps(ECONOMICS.platformFeeBps)}</b>
        </div>
      </div>
      <div className="field">
        <div className="lbl">Share link</div>
        <div className={s.copyrow}>
          <input className="input" readOnly value={shareLink} aria-label="Share link" />
          <button
            className="btn btn-glass btn-sm"
            onClick={async () => {
              await copyText(shareLink);
              toast("Copied");
            }}
          >
            Copy
          </button>
        </div>
      </div>
      <div className="field">
        <div className="lbl">Embed</div>
        <div className={s.copyrow}>
          <input className="input" readOnly value={embedCode} aria-label="Embed code" />
          <button
            className="btn btn-glass btn-sm"
            onClick={async () => {
              await copyText(embedCode);
              toast("Copied");
            }}
          >
            Copy
          </button>
        </div>
      </div>
      <div className="lbl">Ledger</div>
      <ul className={s.ledger}>
        {ledger.length ? (
          ledger.slice(0, 10).map((l) => (
            <li key={l.id}>
              <span>
                {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {l.memo || LEDGER_LABEL[l.type] || l.type}
              </span>
              <b className={l.amount >= 0 ? s.plus : s.minus}>
                {l.amount >= 0 ? "+" : ""}
                {fmt(l.amount)} CR
              </b>
            </li>
          ))
        ) : (
          <li>
            <span>{status === "authenticated" ? "No activity yet. Runs and earnings show up here." : "Sign in with your wallet to see your credits ledger."}</span>
          </li>
        )}
      </ul>
    </>
  );
}
