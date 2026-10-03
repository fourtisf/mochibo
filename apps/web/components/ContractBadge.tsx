"use client";
import { TOKEN_SYMBOL } from "@orbis/shared";
import { PUBLIC_ENV } from "@/lib/env";
import { shortAddress } from "@/lib/format";
import { copyText } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import s from "./Hero.module.css";

/** Token contract address pill. Shows "Coming soon" until NEXT_PUBLIC_TOKEN_ADDRESS is set. */
export function ContractBadge() {
  const toast = useToast();
  const ca = PUBLIC_ENV.tokenAddress;
  return (
    <button
      className={s.ca}
      aria-label={ca ? `Copy ${TOKEN_SYMBOL} contract address` : `${TOKEN_SYMBOL} contract address coming soon`}
      onClick={async () => {
        if (!ca) return toast("Contract address coming soon");
        await copyText(ca);
        toast("Contract address copied");
      }}
    >
      <span className={s.caLabel}>CA</span>
      <code>{ca ? shortAddress(ca) : "Coming soon"}</code>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2.5" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </svg>
    </button>
  );
}
