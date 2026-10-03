"use client";
/** The studio 3D stage. Loaded with next/dynamic({ ssr: false }). */
import { useEffect, useRef, useState } from "react";
import type { CharacterConfig } from "@orbis/shared";
import { createStage, hasWebGL, type Stage } from "@orbis/characters";
import { useStages } from "@/lib/stages";

const WEBGL_MSG = "The 3D preview needs WebGL. Try a recent version of Chrome, Safari or Firefox.";

export default function StudioStage({ config }: { config: CharacterConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);
  const stages = useStages();
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    let st: Stage;
    try {
      st = createStage(canvasRef.current, { halfW: 0.95, halfH: 1.32, camY: 1.02, lookY: 0.8 });
    } catch {
      setFailed(true);
      return;
    }
    st.addActor(cfgRef.current, { rot: 0.15, main: true });
    stageRef.current = st;
    stages.set("studio", st);
    return () => {
      stages.set("studio", null);
      st.dispose();
      stageRef.current = null;
    };
  }, [stages]);

  // Rebuild at most once per frame while the user drags a color picker.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const a = stageRef.current?.main;
      if (a && a.config !== config) a.setConfig(config);
    });
    return () => cancelAnimationFrame(raf);
  }, [config]);

  return (
    <>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="Your agent in 3D. Drag to turn it." />
      {failed && <div className="fallback">{WEBGL_MSG}</div>}
    </>
  );
}
