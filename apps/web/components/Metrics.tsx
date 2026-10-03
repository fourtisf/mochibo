"use client";
import { useEffect, useRef } from "react";
import { TIERS, formatBps } from "@orbis/shared";
import { METRICS } from "@/lib/placeholder";
import { countUp } from "@/lib/countup";
import s from "./Hero.module.css";

const whale = TIERS[TIERS.length - 1];

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
          stops.push(countUp(b, +b.dataset.count!, +(b.dataset.dec || 0), b.dataset.prefix || "", b.dataset.suffix || ""));
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

  const whaleFee = parseFloat(formatBps(whale.feeBps));
  return (
    <>
      <div className={s.metrics} ref={ref}>
        {METRICS.map((m) => (
          <div className={s.metric} key={m.label}>
            <b data-count={m.value} data-dec={m.dec} data-prefix={m.prefix} data-suffix={m.suffix}>
              0
            </b>
            <span>{m.label}</span>
          </div>
        ))}
        <div className={s.metric}>
          <b data-count={whaleFee} data-suffix="%">
            0
          </b>
          <span>run fee for {whale.name} holders</span>
        </div>
      </div>
      <div className={s.metricsNote}>Preview figures</div>
    </>
  );
}
