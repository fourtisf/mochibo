"use client";
/** Landing section: set up a battle, watch it live, vote; recent battles and top fighters beside it. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BATTLE,
  BATTLE_MODE_LABEL,
  BATTLE_TOPICS,
  CHARACTER_BY_ID,
  EXAMPLE_AGENTS,
  normalizeCharacter,
  type BattleFighter,
  type BattleLine,
  type BattleMode,
  type BattleView,
  type FighterRef,
  type PublicAgent,
  type Side,
} from "@orbis/shared";
import { api, authActions, useAuth } from "@/lib/auth";
import { startBattle, useBattleStatus, useBattles, useTopFighters } from "@/lib/battle";
import { portraitUrl } from "@/lib/images";
import { usePreview } from "@/lib/preview/store";
import { unlockSpeech } from "@/lib/talk";
import { Portrait } from "../Portrait";
import { Arena } from "./Arena";
import { VotePanel } from "./VotePanel";
import s from "./BattleSection.module.css";

interface Option {
  key: string;
  ref: FighterRef;
  fighter: BattleFighter;
  group: "Your agents" | "Published agents" | "Example agents";
}

const fighterThumb = (f: BattleFighter) => f.thumb || portraitUrl(CHARACTER_BY_ID[f.baseId] ? f.baseId : "juni");

function usePublished(): PublicAgent[] {
  const [list, setList] = useState<PublicAgent[]>([]);
  useEffect(() => {
    api<{ agents: PublicAgent[] }>("/discover")
      .then((r) => setList(r.agents))
      .catch(() => undefined);
  }, []);
  return list;
}

export function BattleSection() {
  const auth = useAuth();
  const signedIn = auth.status === "authenticated";
  const { agents: mine } = usePreview();
  const published = usePublished();
  const [refresh, setRefresh] = useState(0);
  const status = useBattleStatus(refresh);
  const recent = useBattles(refresh);
  const top = useTopFighters();

  const options = useMemo<Option[]>(() => {
    const own: Option[] = mine.map((a) => ({
      key: `agent:${a.id}`,
      ref: { kind: "agent", id: a.id },
      fighter: { name: a.name, character: a.character, slug: a.published ? a.slug : null, exampleId: null, baseId: a.baseId, thumb: a.thumbnailUrl },
      group: "Your agents",
    }));
    const pub: Option[] = published
      .filter((a) => a.creator !== auth.address)
      .map((a) => ({
        key: `agent:${a.id}`,
        ref: { kind: "agent", id: a.id },
        fighter: { name: a.name, character: normalizeCharacter(a.character), slug: a.slug, exampleId: null, baseId: a.baseId, thumb: a.thumbnailUrl },
        group: "Published agents",
      }));
    const ex: Option[] = EXAMPLE_AGENTS.map((e) => ({
      key: `example:${e.id}`,
      ref: { kind: "example", id: e.id },
      fighter: { name: e.name, character: CHARACTER_BY_ID[e.char].config, slug: null, exampleId: e.id, baseId: e.char, thumb: null },
      group: "Example agents",
    }));
    return [...own, ...pub, ...ex];
  }, [mine, published, auth.address]);

  const [mode, setMode] = useState<BattleMode>("roast");
  const [aKey, setAKey] = useState("");
  const [bKey, setBKey] = useState("");
  const [topic, setTopic] = useState("");
  // Defaults: your newest agent (or the first example) against a different example, until you pick.
  const picked = useRef(false);
  useEffect(() => {
    if (!options.length) return;
    setAKey((k) => (picked.current && options.some((o) => o.key === k) ? k : options[0].key));
    setBKey((k) => (options.some((o) => o.key === k) ? k : (options.find((o) => o.group === "Example agents" && o.key !== options[0].key) ?? options[1]).key));
  }, [options]);
  const A = options.find((o) => o.key === aKey);
  const B = options.find((o) => o.key === bKey);

  // A battle in progress (or just finished) in this section.
  const [live, setLive] = useState<{ a: BattleFighter; b: BattleFighter; lines: BattleLine[]; writing: Side | null; done: boolean; battle: BattleView | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const start = async () => {
    if (!signedIn) return authActions.openSignIn();
    if (!A || !B) return;
    if (A.key === B.key) return setError("Pick two different agents.");
    if (mode === "debate" && !topic.trim()) return setError("Give the debate a topic: a hot take for one agent to defend and the other to attack.");
    unlockSpeech();
    setError("");
    setBusy(true);
    setLive({ a: A.fighter, b: B.fighter, lines: [], writing: "a", done: false, battle: null });
    ctrl.current?.abort();
    const ac = (ctrl.current = new AbortController());
    await startBattle(
      { mode, topic: topic.trim(), a: A.ref, b: B.ref },
      {
        onStart: () => undefined,
        onLine: (side) => setLive((l) => (l ? { ...l, writing: side } : l)),
        onLineEnd: (line) => setLive((l) => (l ? { ...l, lines: [...l.lines, line], writing: null } : l)),
        onDone: (battle) => {
          setLive((l) => (l ? { ...l, writing: null, done: true, battle } : l));
          setRefresh((n) => n + 1);
        },
        onError: (message) => {
          setError(message);
          setLive((l) => (l && l.lines.length ? { ...l, writing: null, done: true } : null));
        },
      },
      ac.signal,
    );
    setBusy(false);
  };

  const groups = ["Your agents", "Published agents", "Example agents"] as const;
  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => {
        const list = options.filter((o) => o.group === g);
        return list.length ? (
          <optgroup key={g} label={g}>
            {list.map((o) => (
              <option key={o.key} value={o.key}>
                {o.fighter.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );

  const cost = status?.costCr ?? BATTLE.costCr;
  const prize = status?.prizeCr ?? BATTLE.prizeCr;
  return (
    <section id="battle">
      <div className="wrap">
        <div className="head center">
          <h2>Agent Battle.</h2>
          <p>
            Put two agents on one stage. They roast each other or argue a hot take, {BATTLE.rounds} lines each, out loud. People vote for a day, and the winner&apos;s creator gets {prize} CR.
          </p>
        </div>
        <div className={s.layout}>
          <div>
            {live ? (
              <div className={s.liveWrap}>
                <Arena key={`${live.a.name}-${live.b.name}-${live.battle?.slug ?? "live"}`} a={live.a} b={live.b} lines={live.lines} writing={live.writing} complete={live.done} autoplay winner={live.battle?.winner} />
                {error && <p className={s.error}>{error}</p>}
                {live.battle && <VotePanel battle={live.battle} prizeCr={prize} onChange={(b) => setLive((l) => (l ? { ...l, battle: b } : l))} />}
                {live.done && (
                  <div className={s.after}>
                    {live.battle && (
                      <a className="btn btn-glass btn-sm" href={`/b/${live.battle.slug}`}>
                        Open battle page
                      </a>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => setLive(null)}>
                      New battle
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={`glass ${s.setup}`}>
                <div className="seg">
                  {(["roast", "debate"] as const).map((m) => (
                    <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                      {BATTLE_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
                <div className={s.faceoff}>
                  <div className={s.corner}>
                    {A && <Portrait src={fighterThumb(A.fighter)} glow={A.fighter.character.glow} />}
                    <span className="lbl">{mode === "debate" ? "Bull (for)" : "Your fighter"}</span>
                    {select(aKey, (v) => ((picked.current = true), setAKey(v)), "First agent")}
                  </div>
                  <b className={s.vs}>vs</b>
                  <div className={s.corner}>
                    {B && <Portrait src={fighterThumb(B.fighter)} glow={B.fighter.character.glow} />}
                    <span className="lbl">{mode === "debate" ? "Bear (against)" : "Opponent"}</span>
                    {select(bKey, (v) => ((picked.current = true), setBKey(v)), "Second agent")}
                  </div>
                </div>
                <div className="field">
                  <label className="lbl" htmlFor="battleTopic">
                    {mode === "debate" ? "Hot take to argue" : "Theme"} <small>{mode === "debate" ? "required" : "optional"}</small>
                  </label>
                  <input
                    id="battleTopic"
                    className="input"
                    maxLength={BATTLE.topicMax}
                    value={topic}
                    placeholder={mode === "debate" ? "For example: memecoins beat blue chips" : "For example: who has the worst trades"}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                  <div className="try-row">
                    <span>Try</span>
                    {BATTLE_TOPICS[mode].map((t) => (
                      <button key={t} type="button" className="chip try-chip" title={t} onClick={() => setTopic(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className={s.error}>{error}</p>}
                <button className="btn btn-primary btn-block" disabled={busy || (signedIn && status?.live === false)} onClick={start}>
                  {!signedIn ? "Connect wallet to battle" : status?.live === false ? "Battles are not switched on yet" : `Start battle for ${cost} CR`}
                </button>
                <p className={s.meta}>
                  {signedIn && status ? `${status.usedToday} of ${status.perDay} battles today. ` : ""}Lines are written by AI for fun. Not financial advice.
                </p>
              </div>
            )}
          </div>
          <aside className={s.side}>
            <h3>Recent battles</h3>
            {recent.length ? (
              <ul className={s.recent}>
                {recent.slice(0, 6).map((r) => (
                  <li key={r.slug}>
                    <a href={`/b/${r.slug}`} className={s.card}>
                      <span className={s.pair}>
                        <Portrait src={fighterThumb(r.a)} glow={r.a.character.glow} />
                        <Portrait src={fighterThumb(r.b)} glow={r.b.character.glow} />
                      </span>
                      <span className={s.cardText}>
                        <b>
                          {r.a.name} vs {r.b.name}
                        </b>
                        <small>
                          {BATTLE_MODE_LABEL[r.mode]}
                          {r.topic ? `: ${r.topic}` : ""}
                        </small>
                        <small>
                          {r.status === "closed"
                            ? r.winner === "tie"
                              ? "Tie"
                              : `${r[r.winner as Side]?.name ?? ""} won`
                            : `${r.votes.a + r.votes.b} votes, voting open`}
                        </small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.empty}>No battles yet. Start the first one.</p>
            )}
            {top.length > 0 && (
              <>
                <h3>Top fighters</h3>
                <ol className={s.top}>
                  {top.map((f) => (
                    <li key={f.slug}>
                      <a href={`/a/${f.slug}`}>{f.name}</a>
                      <span>
                        {f.battleWins} {f.battleWins === 1 ? "win" : "wins"}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
