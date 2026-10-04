"use client";
/**
 * The hero 3D stage. Loaded with next/dynamic({ ssr: false }) so three.js stays out of the
 * server bundle, and the stage is created after first paint so the hero text renders first.
 */
import { useEffect, useRef, useState } from "react";
import { CHARACTERS, type BaseCharacter, type CharacterConfig } from "@orbis/shared";
import { createStage, getLowPower, hasWebGL, type Actor, type Stage } from "@orbis/characters";
import { isReducedMotion } from "@/lib/hooks";
import { rnd } from "@/lib/format";
import { useStages } from "@/lib/stages";
import { Talker, registerTalker, talkerFor, voiceFor } from "@/lib/talk";
import { SpeechBubble } from "./SpeechBubble";

export type HeroStageMode = { kind: "lineup"; idx: number } | { kind: "single"; config: CharacterConfig };

const AMBIENT = ["wave", "nod", "dance", "cheer", "shrug", "spin", "jump"] as const;
const an = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");
/** What a character says on each tap, in turn. */
const greetings = (c: BaseCharacter) => [
  `Hi, I'm ${c.name}!`,
  `I'm ${an(c.role)} ${c.role.toLowerCase()}. Give me skills and I'll get to work.`,
  "Build your own agent in the studio below.",
  "Hehe, that tickles!",
];

const WEBGL_MSG = "The 3D preview needs WebGL. Try a recent version of Chrome, Safari or Firefox.";

export default function HeroStage({ mode, label }: { mode: HeroStageMode; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [talker, setTalker] = useState<Talker | null>(null);
  const stages = useStages();
  // Which base character each actor is, and how often it was tapped (for the next greeting line).
  const who = useRef(new Map<Actor, BaseCharacter>());
  const taps = useRef(new Map<string, number>());

  // Create after first paint, dispose on unmount.
  useEffect(() => {
    let raf = 0;
    let disposed = false;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (disposed || !canvasRef.current) return;
        if (!hasWebGL()) return setFailed(true);
        try {
          const st = createStage(canvasRef.current, {
            halfW: (ar) => (ar < 0.95 ? 1.0 : 2.35),
            halfH: 1.34,
            camY: 1.0,
            lookY: 0.8,
            onTap: (a, s) => {
              if (a !== s.main) a.setExpression("love", 1.6);
              const c = who.current.get(a);
              if (!c) return;
              const n = taps.current.get(c.id) ?? 0;
              taps.current.set(c.id, n + 1);
              const lines = greetings(c);
              t.say(a, lines[n % lines.length], voiceFor(c.config));
            },
          });
          const t = new Talker(st);
          registerTalker("hero", t);
          setTalker(t);
          stageRef.current = st;
          stages.set("hero", st);
          setReady(true);
        } catch {
          setFailed(true);
        }
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (stageRef.current) {
        registerTalker("hero", null);
        stages.set("hero", null);
        stageRef.current.dispose();
        stageRef.current = null;
      }
    };
  }, [stages]);

  // Lineup: previous, current (main), next. Low-power devices show only the middle one.
  const key = mode.kind === "lineup" ? `l${mode.idx}` : `s${JSON.stringify(mode.config)}`;
  useEffect(() => {
    const st = stageRef.current;
    if (!ready || !st) return;
    talkerFor("hero")?.stop();
    st.clear();
    who.current.clear();
    if (mode.kind === "single") {
      st.addActor(mode.config, { main: true });
      return;
    }
    const n = CHARACTERS.length;
    const i = mode.idx;
    const add = (c: BaseCharacter, opts: Parameters<Stage["addActor"]>[1]) => {
      const a = st.addActor(c.config, opts);
      who.current.set(a, c);
      return a;
    };
    if (!getLowPower()) add(CHARACTERS[(i - 1 + n) % n], { x: -1.5, z: -0.45, rot: 0.55, scale: 0.9 });
    const main = add(CHARACTERS[i], { x: 0, z: 0.2, rot: 0.12, main: true });
    if (!getLowPower()) add(CHARACTERS[(i + 1) % n], { x: 1.5, z: -0.45, rot: -0.55, scale: 0.9 });
    main.play("wave");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  // Ambient motions every 3.6 s while on screen.
  useEffect(() => {
    if (!ready || mode.kind !== "lineup" || isReducedMotion()) return;
    const t = setInterval(() => {
      const st = stageRef.current;
      if (!st || !st.visible) return;
      const a = st.actors.length ? rnd(st.actors) : null;
      if (!a || a.isPlaying) return;
      a.play(rnd(AMBIENT));
    }, 3600);
    return () => clearInterval(t);
  }, [ready, mode.kind]);

  return (
    <>
      <canvas ref={canvasRef} className="stage-canvas" aria-label={label} />
      <SpeechBubble talker={talker} />
      {failed && <div className="fallback">{WEBGL_MSG}</div>}
    </>
  );
}
