"use client";
/** Speech bubble that follows the speaking actor's head on its stage. */
import { useEffect, useRef } from "react";
import { useTalkerText, type Talker } from "@/lib/talk";

/** `minTop` keeps the bubble below overlays at the top of the stage (for example the studio tools). */
export function SpeechBubble({ talker, minTop = 8 }: { talker: Talker | null; minTop?: number }) {
  const text = useTalkerText(talker);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text || !talker) return;
    let raf = 0;
    const place = () => {
      const el = ref.current;
      const box = el?.parentElement;
      const actor = talker.speaker;
      const p = actor ? talker.stage.screenPoint(actor) : null;
      if (el && box && p) {
        const W = box.clientWidth, H = box.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
        let left: number, top: number, side: "" | "left" | "right" = "";
        if (p.y - h - 6 >= minTop) {
          // Above the head, tail pointing down at it.
          left = Math.min(Math.max(8, p.x - 26), W - w - 8);
          top = p.y - h - 6;
          el.style.setProperty("--tail", `${Math.min(Math.max(18, p.x - left), w - 18)}px`);
        } else {
          // No room above: beside the head, on the side with more space.
          const head = H * 0.13;
          side = p.x > W / 2 ? "left" : "right";
          left = side === "left" ? Math.max(8, p.x - head - w) : Math.min(W - w - 8, p.x + head);
          top = Math.min(Math.max(minTop, p.y + head * 0.7), H - h - 8);
        }
        el.dataset.side = side;
        el.style.transform = `translate(${left}px, ${top}px)`;
        el.style.visibility = "visible";
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [text, talker, minTop]);

  if (!text) return null;
  return (
    <div ref={ref} className="speech" role="status" aria-live="polite" style={{ visibility: "hidden" }}>
      <span key={text}>{text}</span>
    </div>
  );
}
