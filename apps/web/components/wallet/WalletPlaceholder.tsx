import s from "../Nav.module.css";

export const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="3.5" />
    <path d="M16 12.5h2" />
  </svg>
);

/** Same look as the real button, shown until the wallet code has loaded. */
export function WalletPlaceholder() {
  return (
    <button className="btn btn-primary btn-sm" aria-busy="true" tabIndex={-1}>
      <WalletIcon />
      <span className={s.walletLabel}>Connect wallet</span>
    </button>
  );
}
