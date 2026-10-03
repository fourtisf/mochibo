"use client";
import { POWERS } from "@orbis/shared";
import { PowerIcon } from "@/lib/icons";
import { useStages } from "@/lib/stages";

export function PowerDock({ slot, className }: { slot: "hero" | "studio"; className?: string }) {
  const stages = useStages();
  return (
    <div className={`dock glass${className ? " " + className : ""}`}>
      {POWERS.map(([k, n], i) => (
        <button key={k} className="pw" aria-label={`${n} power, key ${i + 1}`} onClick={() => stages.get(slot)?.power(k)}>
          <PowerIcon name={k} />
          <kbd>{i + 1}</kbd>
          <span className="tip">{n}</span>
        </button>
      ))}
    </div>
  );
}
