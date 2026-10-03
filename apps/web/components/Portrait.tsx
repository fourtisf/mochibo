import type { CSSProperties, ReactNode } from "react";

/** Character portrait frame with the glow-tinted backdrop. */
export function Portrait({ src, glow, className, children, alt = "" }: { src?: string; glow: string; className?: string; children?: ReactNode; alt?: string }) {
  return (
    <div className={`portrait${className ? " " + className : ""}`} style={{ "--g": glow } as CSSProperties}>
      {children}
      <img alt={alt} src={src || undefined} loading="lazy" decoding="async" />
    </div>
  );
}
