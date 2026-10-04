"use client";
/** Two agents on one 3D stage, facing each other. Loaded with next/dynamic({ ssr: false }). */
import { useEffect, useRef, useState } from "react";
import type { CharacterConfig } from "@orbis/shared";
import { createStage, hasWebGL, type Actor, type Stage } from "@orbis/characters";
import { Talker, registerTalker } from "@/lib/talk";
import { SpeechBubble } from "../SpeechBubble";

export interface BattleActors {
  stage: Stage;
  a: Actor;
  b: Actor;
  talker: Talker;
}

export default function BattleStage({ a, b, onReady }: { a: CharacterConfig; b: CharacterConfig; onReady: (x: BattleActors | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [talker, setTalker] = useState<Talker | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    let st: Stage;
    try {
      st = createStage(canvasRef.current, { halfW: (ar) => (ar < 1 ? 1.55 : 1.9), halfH: 1.2, camY: 1.0, lookY: 0.78 });
    } catch {
      setFailed(true);
      return;
    }
    const actorA = st.addActor(a, { x: -0.85, rot: 0.5, main: true });
    const actorB = st.addActor(b, { x: 0.85, rot: -0.5 });
    const t = new Talker(st);
    registerTalker("battle", t);
    setTalker(t);
    ready.current({ stage: st, a: actorA, b: actorB, talker: t });
    return () => {
      ready.current(null);
      registerTalker("battle", null);
      st.dispose();
    };
    // The fighters are fixed for a battle; a new battle remounts this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="The two agents in 3D." />
      <SpeechBubble talker={talker} />
      {failed && <div className="fallback">The battle stage needs WebGL. The lines still show below.</div>}
    </>
  );
}
