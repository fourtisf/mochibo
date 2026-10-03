import type { PowerName } from "@orbis/shared";

const PATHS: Record<PowerName, JSX.Element> = {
  orb: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 3" />
    </>
  ),
  shield: <path d="M12 3l7.5 3v6c0 4.8-3.3 7.8-7.5 9-4.2-1.2-7.5-4.2-7.5-9V6z" />,
  blink: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
  levitate: (
    <>
      <path d="M12 18V5M6.5 10.5L12 5l5.5 5.5" />
      <path d="M6 21h12" />
    </>
  ),
  scan: <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />,
  hype: (
    <>
      <path d="M4.5 19.5L9 7l8 8z" />
      <path d="M14 3.5l.8 2M19.5 9.5l2-.8M16.5 6l2.5-2.5" />
    </>
  ),
};

export function PowerIcon({ name, size = 22 }: { name: PowerName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFE27A" aria-hidden="true">
      <path d="M12 2l3 7 7 .6-5.3 4.6 1.7 7.3L12 17.8 5.6 21.5l1.7-7.3L2 9.6 9 9z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
