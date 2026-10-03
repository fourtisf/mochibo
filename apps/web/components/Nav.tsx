"use client";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@orbis/shared";
import { LogoMark } from "@/lib/icons";
import { PUBLIC_ENV } from "@/lib/env";
import { fmt, shortAddress } from "@/lib/format";
import { usePreview } from "@/lib/preview/store";
import { useToast } from "@/lib/toast";
import s from "./Nav.module.css";

const LINKS = [
  ["#features", "Product"],
  ["#studio", "Studio"],
  ["#discover", "Discover"],
  ["#creators", "Creators"],
  ["#rewards", "Rewards"],
  ["#faq", "FAQ"],
] as const;

const TOPUPS = [100, 500, 1000];

export function Nav() {
  const { credits, wallet, addCredits, toggleWallet } = usePreview();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const topup = (v: number) => {
    // Phase 2: POST /admin/credits (preview grants, only when PREVIEW_CREDITS=true).
    addCredits(v);
    toast(`Added ${fmt(v)} preview credits`);
  };

  return (
    <header className={s.navWrap}>
      <nav className={s.nav} aria-label="Main">
        <a className="logo" href="#top" aria-label={`${APP_NAME} home`}>
          <LogoMark />
          {APP_NAME}
        </a>
        <div className={s.links}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </div>
        <div className={s.right}>
          <div className={s.credits} ref={wrapRef}>
            <button
              className={s.creditsBtn}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Credits balance"
              onClick={() => setOpen((o) => !o)}
            >
              <span className={s.crDot} />
              <span>{fmt(credits)}</span>&nbsp;CR
            </button>
            <div className={`${s.pop}${open ? " " + s.open : ""}`} role="dialog" aria-label="Add preview credits">
              <p>Preview credits are free and have no monetary value. Live top-ups use USDG on Robinhood Chain.</p>
              {PUBLIC_ENV.previewCredits && (
                <div className={s.row}>
                  {TOPUPS.map((v) => (
                    <button key={v} className="btn btn-glass btn-xs" onClick={() => topup(v)}>
                      +{fmt(v)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const a = toggleWallet();
              toast(a ? "Wallet connected (preview)" : "Wallet disconnected");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <rect x="3" y="6" width="18" height="13" rx="3.5" />
              <path d="M16 12.5h2" />
            </svg>
            <span className={s.walletLabel}>{wallet ? shortAddress(wallet) : "Connect wallet"}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
