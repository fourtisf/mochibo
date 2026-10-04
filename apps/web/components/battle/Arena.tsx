"use client";
/**
 * Plays a battle on the stage: each line in turn, spoken with a speech bubble, the speaker
 * gesturing and the other agent reacting. Works live (lines arrive while the AI writes them) and
 * as a replay. The transcript below shows the lines that have been said so far.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleFighter, BattleLine, MotionName, Side } from "@orbis/shared";
import { unlockSpeech, voiceFor } from "@/lib/talk";
import type { BattleActors } from "./BattleStage";
import s from "./Battle.module.css";

const BattleStage = dynamic(() => import("./BattleStage"), { ssr: false });

const GESTURES: MotionName[] = ["point", "shrug", "nod", "point", "cheer"];
const REACTIONS: MotionName[] = ["shrug", "jump", "nod", "spin"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Arena({
  a,
  b,
  lines,
  writing,
  complete,
  autoplay,
  winner,
  onFinished,
}: {
  a: BattleFighter;
  b: BattleFighter;
  lines: BattleLine[];
  /** Live: the side whose line the AI is writing now. */
  writing?: Side | null;
  /** All lines are in. */
  complete: boolean;
  /** Start playing as soon as the stage is ready (live battles). Replays wait for the Play button. */
  autoplay: boolean;
  winner?: Side | "tie" | null;
  onFinished?: () => void;
}) {
  const [actors, setActors] = useState<BattleActors | null>(null);
  const [playing, setPlaying] = useState(autoplay);
  const [played, setPlayed] = useState(0);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const busy = useRef(false);
  const run = useRef(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const listRef = useRef<HTMLOListElement>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  // Speak the next line when it is available and nobody is talking.
  useEffect(() => {
    if (!playing || busy.current || played >= lines.length) return;
    const id = run.current;
    busy.current = true;
    const line = lines[played];
    const fighter = line.side === "a" ? a : b;
    (async () => {
      setSpeaking(played);
      if (actors) {
        const me = line.side === "a" ? actors.a : actors.b;
        const other = line.side === "a" ? actors.b : actors.a;
        me.play(GESTURES[played % GESTURES.length]);
        other.setExpression("focus", 3);
        actors.talker.say(me, line.text, voiceFor(fighter.character));
        await actors.talker.whenIdle();
        if (run.current !== id) return;
        other.play(REACTIONS[played % REACTIONS.length]);
        await wait(500);
      } else {
        // No 3D (or still loading): give people time to read.
        await wait(Math.min(5000, 1200 + line.text.length * 40));
      }
      if (run.current !== id) return;
      busy.current = false;
      setSpeaking(null);
      setPlayed((n) => n + 1);
    })();
  }, [playing, played, lines, actors, a, b]);

  // The writing side thinks while its line is being written.
  useEffect(() => {
    if (!actors || !writing || speaking !== null) return;
    const actor = writing === "a" ? actors.a : actors.b;
    actor.play("think");
    const t = setInterval(() => !actor.isPlaying && actor.play("think"), 2600);
    return () => clearInterval(t);
  }, [actors, writing, speaking]);

  // The end: the winner celebrates, if there is one.
  const done = complete && played >= lines.length && lines.length > 0;
  useEffect(() => {
    if (!done) return;
    if (actors && (winner === "a" || winner === "b")) {
      (winner === "a" ? actors.a : actors.b).play("dance");
      (winner === "a" ? actors.b : actors.a).play("bow");
    } else if (actors) {
      actors.a.play("bow");
      actors.b.play("bow");
    }
    finishedRef.current?.();
  }, [done, actors, winner]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [played, speaking]);

  const replay = useCallback(() => {
    unlockSpeech();
    run.current++;
    busy.current = false;
    actors?.talker.stop();
    setSpeaking(null);
    setPlayed(0);
    setPlaying(true);
  }, [actors]);

  const skip = () => {
    run.current++;
    busy.current = false;
    actors?.talker.stop();
    setSpeaking(null);
    setPlayed(linesRef.current.length);
    setPlaying(true);
  };

  const shown = lines.slice(0, speaking !== null ? speaking + 1 : played);
  return (
    <div className={s.arena}>
      <div className={`win ${s.stage}`}>
        <BattleStage a={a.character} b={b.character} onReady={setActors} />
        <div className={s.plates}>
          <span className={`${s.plate} ${winner === "a" ? s.won : ""}`}>{a.name}</span>
          <b className={s.vs}>vs</b>
          <span className={`${s.plate} ${winner === "b" ? s.won : ""}`}>{b.name}</span>
        </div>
        {!playing && (
          <button className={`btn btn-primary ${s.play}`} onClick={replay}>
            Play battle
          </button>
        )}
      </div>
      <ol ref={listRef} className={s.lines} aria-live="polite">
        {shown.map((l, i) => (
          <li key={i} className={`${s.line} ${l.side === "b" ? s.right : ""} ${speaking === i ? s.now : ""}`}>
            <b>{l.side === "a" ? a.name : b.name}</b>
            <span>{l.text}</span>
          </li>
        ))}
        {writing && speaking === null && played >= lines.length && (
          <li className={`${s.line} ${writing === "b" ? s.right : ""} ${s.typing}`}>
            <b>{writing === "a" ? a.name : b.name}</b>
            <span>is thinking of a comeback…</span>
          </li>
        )}
      </ol>
      <div className={s.arenaFoot}>
        {playing && !done && lines.length > played + 1 && (
          <button className="btn btn-glass btn-xs" onClick={skip}>
            Show all lines
          </button>
        )}
        {done && (
          <button className="btn btn-glass btn-xs" onClick={replay}>
            Replay
          </button>
        )}
      </div>
    </div>
  );
}
