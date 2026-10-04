"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { APP_NAME, ECONOMICS, SOCIAL } from "@orbis/shared";
import { useAccount } from "@/lib/account";
import { authActions, loadSession, useAuth } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { WalletPlaceholder } from "./wallet/WalletPlaceholder";
import s from "./Nav.module.css";

// Wallet libraries load after first paint, outside the first-load bundle.
const WalletButton = dynamic(() => import("./wallet/WalletButton"), { ssr: false, loading: () => <WalletPlaceholder /> });

const LINKS = [
  ["/#features", "Product"],
  ["/#studio", "Studio"],
  ["/#discover", "Discover"],
  ["/#creators", "Creators"],
  ["/#rewards", "Holders"],
  ["/#faq", "FAQ"],
] as const;

export function Nav() {
  const { balance } = useAccount();
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Read the session right away (a tiny request), not after the wallet libraries load.
  useEffect(() => {
    void loadSession();
  }, []);

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

  return (
    <header className={s.navWrap}>
      <nav className={s.nav} aria-label="Main">
        <a className="logo" href="/#top" aria-label={`${APP_NAME} home`}>
          <img src="/brand/mochibo-head.png" alt="" width={30} height={30} className={s.logoImg} />
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
          <a className={s.social} href={SOCIAL.x} target="_blank" rel="noopener noreferrer" aria-label={`${APP_NAME} on X`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.75 3h3.07l-6.72 7.68L22 21h-6.19l-4.85-6.34L5.4 21H2.33l7.19-8.21L2 3h6.35l4.38 5.79L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
            </svg>
          </a>
          <div className={s.credits} ref={wrapRef}>
            <button
              className={s.creditsBtn}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Credits balance"
              onClick={() => setOpen((o) => !o)}
            >
              <span className={s.crDot} />
              {signedIn ? (
                <>
                  <span>{balance !== null ? fmt(balance) : "…"}</span>&nbsp;CR
                </>
              ) : (
                <span>Get {ECONOMICS.previewStartCr} CR</span>
              )}
            </button>
            <div className={`${s.pop}${open ? " " + s.open : ""}`} role="dialog" aria-label="Credits">
              {signedIn ? (
                <p>Credits pay for runs and are saved to your wallet. Failed runs are refunded. Top-ups with USDG on Robinhood Chain are coming soon.</p>
              ) : (
                <>
                  <p>Sign in with your wallet to get {ECONOMICS.previewStartCr} free credits, once per wallet. Top-ups with USDG on Robinhood Chain are coming soon.</p>
                  <div className={s.row}>
                    <button
                      className="btn btn-glass btn-xs"
                      onClick={() => {
                        setOpen(false);
                        authActions.openSignIn();
                      }}
                    >
                      Connect wallet
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
