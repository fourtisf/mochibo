"use client";
import { useEffect, useRef } from "react";
import { CHARACTERS, ECONOMICS, LIMITS, SKILLS, formatBps } from "@orbis/shared";
import { countUp } from "@/lib/countup";
import s from "./Hero.module.css";

/**
 * Product facts while there is no real usage yet. Phase 3 swaps these for live numbers
 * from GET /stats (agents built, runs, paid to creators).
 */
const FACTS = [
  { value: CHARACTERS.length, label: "characters to start from" },
  { value: SKILLS.length, label: "working skills to equip" },
  { value: LIMITS.priceMax, label: "CR max price you can set per run" },
  { value: Number(formatBps(ECONOMICS.platformFeeBps).replace("%", "")), suffix: "%", label: "creator fee, lower for holders" },
];

export function Metrics() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-count]") ?? []);
    const stops: (() => void)[] = [];
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          const b = en.target as HTMLElement;
          stops.push(countUp(b, +b.dataset.count!, 0, "", b.dataset.suffix || ""));
          obs.unobserve(b);
        }),
      { threshold: 0.6 },
    );
    els.forEach((e) => obs.observe(e));
    return () => {
      obs.disconnect();
      stops.forEach((f) => f());
    };
  }, []);

  return (
    <>
      <div className={s.metrics} ref={ref}>
        {FACTS.map((m) => (
          <div className={s.metric} key={m.label}>
            <b data-count={m.value} data-suffix={m.suffix || ""}>
              0
            </b>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <div className={s.metricsNote}>Live usage stats appear here once publishing opens</div>
    </>
  );
}
