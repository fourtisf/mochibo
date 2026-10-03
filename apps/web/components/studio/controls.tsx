"use client";
import { CHIPS, PALETTES, type ChipKey, type ColorKey } from "@orbis/shared";

export function Swatches({ k, value, onPick }: { k: ColorKey; value: string; onPick: (v: string) => void }) {
  const cur = value.toLowerCase();
  return (
    <div className="sws">
      {PALETTES[k].map((c) => (
        <button key={c} className="sw" style={{ background: c }} aria-label={`${k} ${c}`} aria-pressed={c.toLowerCase() === cur} onClick={() => onPick(c)} />
      ))}
      <label className="swc" title="Any color">
        <input type="color" aria-label={`Custom ${k} color`} value={value} onChange={(e) => onPick(e.target.value.toUpperCase())} />
      </label>
    </div>
  );
}

export function Chips({ k, value, onPick, hideHumanOnly }: { k: ChipKey; value: string; onPick: (v: string) => void; hideHumanOnly?: boolean }) {
  return (
    <>
      {CHIPS[k].map((opt) => {
        const [v, label] = opt;
        const humanOnly = opt.length > 2 && opt[2];
        if (hideHumanOnly && humanOnly) return null;
        return (
          <button key={v} className="chip" aria-pressed={v === value} onClick={() => onPick(v)}>
            {label}
          </button>
        );
      })}
    </>
  );
}
