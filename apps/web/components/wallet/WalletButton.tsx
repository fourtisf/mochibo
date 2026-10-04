"use client";
/**
 * Real wallet connection (RainbowKit on wagmi + viem) plus Sign-In with Ethereum: after connecting,
 * the wallet signs a one-time message (no gas) and the API sets an httpOnly session cookie.
 * Loaded lazily from the nav so the wallet libraries stay out of the first-load bundle.
 *
 * The signature step is our own (SignInDialog), not RainbowKit's: it asks the connected wallet's
 * provider directly with personal_sign, which works when several wallet extensions are installed
 * or the wallet is on another chain, and it shows the wallet's real error instead of a generic one.
 */
import "@rainbow-me/rainbowkit/styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectButton, RainbowKitProvider, darkTheme, useConnectModal, type DisclaimerComponent, type Theme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toHex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { WagmiProvider, useAccount } from "wagmi";
import { api, authActions, loadSession, useAuth } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { shortAddress } from "@/lib/format";
import { CHAIN_CONFIGURED, robinhoodChain } from "@/lib/wallet/chain";
import { makeWagmiConfig } from "@/lib/wallet/config";
import s from "../Nav.module.css";
import { WalletIcon, WalletPlaceholder } from "./WalletPlaceholder";

const base = darkTheme({ accentColor: "#F5F3FF", accentColorForeground: "#120E2B", borderRadius: "large", overlayBlur: "small" });
const theme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "#18143A",
    modalBorder: "rgba(255,255,255,0.14)",
    modalText: "#F5F3FF",
    modalTextSecondary: "#B7B1DA",
    modalTextDim: "#7E77A6",
    actionButtonSecondaryBackground: "rgba(255,255,255,0.06)",
    actionButtonBorder: "rgba(255,255,255,0.1)",
    generalBorder: "rgba(255,255,255,0.1)",
    menuItemBackground: "rgba(139,124,255,0.16)",
    closeButtonBackground: "rgba(255,255,255,0.06)",
    closeButton: "#B7B1DA",
    profileForeground: "#18143A",
    profileAction: "rgba(255,255,255,0.06)",
    profileActionHover: "rgba(255,255,255,0.1)",
    connectButtonBackground: "#F5F3FF",
    connectButtonText: "#120E2B",
    modalBackdrop: "rgba(6,4,18,0.7)",
  },
  fonts: { body: 'var(--font-geist-sans), "Geist", system-ui, sans-serif' },
  shadows: { ...base.shadows, dialog: "0 40px 100px -20px rgba(0,0,0,0.7)" },
};

const Disclaimer: DisclaimerComponent = ({ Text, Link }) => (
  <Text>
    By connecting a wallet you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy</Link>. Mochibo never asks for your seed phrase.
  </Text>
);

const STATEMENT = "Sign in to Mochibo. This request will not trigger a blockchain transaction or cost any gas.";

async function signOut() {
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  authActions.signedOut();
}

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type WalletError = { code?: number; shortMessage?: string; message?: string; details?: string };

/** A readable reason from a wallet or viem error. */
function reason(e: unknown): string {
  const err = (e ?? {}) as WalletError;
  const text = err.shortMessage || err.details || err.message || "Unknown error";
  return text.split("\n")[0].slice(0, 160);
}

/** Connect, then sign: one flow for every "connect wallet" button on the page. */
function useSignInFlow() {
  const { openConnectModal } = useConnectModal();
  const { address, status, connector } = useAccount();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"idle" | "signing" | "verifying">("idle");
  const [error, setError] = useState("");
  const wantSignIn = useRef(false);
  const prev = useRef(status);

  const start = useCallback(() => {
    setError("");
    if (status === "connected") setOpen(true);
    else {
      wantSignIn.current = true;
      openConnectModal?.();
    }
  }, [status, openConnectModal]);

  useEffect(() => {
    authActions.registerOpener(start);
    return () => authActions.registerOpener(null);
  }, [start]);

  useEffect(() => {
    const was = prev.current;
    prev.current = status;
    // Right after a connect the user asked for, go straight to the signature.
    if (status === "connected" && was !== "connected" && wantSignIn.current && auth.status !== "authenticated") {
      wantSignIn.current = false;
      setOpen(true);
    }
    // Only a real disconnect counts: on page load the wallet starts as "disconnected" or "reconnecting".
    if (was === "connected" && status === "disconnected") {
      setOpen(false);
      if (auth.status === "authenticated") void signOut();
    }
    if (auth.status === "authenticated" && status === "connected" && address && address.toLowerCase() !== auth.address) void signOut();
  }, [status, address, auth]);

  useEffect(() => {
    if (auth.status === "authenticated") setOpen(false);
  }, [auth.status]);

  const sign = useCallback(async () => {
    if (!address || !connector) return;
    setError("");
    setStep("signing");
    try {
      const provider = (await connector.getProvider()) as Eip1193;
      const chainId = Number(await provider.request({ method: "eth_chainId" }));
      const { nonce } = await api<{ nonce: string }>("/auth/nonce");
      const message = createSiweMessage({ domain: window.location.host, address, statement: STATEMENT, uri: window.location.origin, version: "1", chainId, nonce });
      let signature: string;
      try {
        signature = (await provider.request({ method: "personal_sign", params: [toHex(message), address] })) as string;
      } catch (e) {
        const err = e as WalletError;
        if (err.code === 4001 || /reject|denied|cancel/i.test(reason(e))) {
          setError("You cancelled the signature. Press Sign message to try again.");
          return;
        }
        console.error("[sign-in] wallet could not sign", e);
        setError(`Your wallet could not sign: ${reason(e)}`);
        return;
      }
      setStep("verifying");
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const body = (await res.json().catch(() => ({}))) as { address?: string; message?: string };
      if (!res.ok || !body.address) {
        setError(body.message || `Sign-in failed (HTTP ${res.status}). Try again.`);
        return;
      }
      authActions.signedIn(body.address);
    } catch (e) {
      console.error("[sign-in]", e);
      setError(`Sign-in failed: ${reason(e)}`);
    } finally {
      setStep("idle");
    }
  }, [address, connector]);

  return { open, setOpen, step, error, sign, start };
}

function SignInDialog({ flow }: { flow: ReturnType<typeof useSignInFlow> }) {
  if (!flow.open) return null;
  const busy = flow.step !== "idle";
  // Portal to <body>: the nav's backdrop-filter would otherwise trap this fixed overlay inside the nav.
  return createPortal(
    <div className={s.signBackdrop} onClick={(e) => e.target === e.currentTarget && !busy && flow.setOpen(false)}>
      <div className={s.signCard} role="dialog" aria-modal="true" aria-labelledby="sign-title">
        <h3 id="sign-title">Verify your wallet</h3>
        <p>Sign a free message to finish signing in. It does not send a transaction or cost any gas.</p>
        {flow.error && (
          <p className={s.signError} role="alert">
            {flow.error}
          </p>
        )}
        <div className={s.signRow}>
          <button className="btn btn-primary" onClick={flow.sign} disabled={busy}>
            {flow.step === "signing" ? "Check your wallet…" : flow.step === "verifying" ? "Verifying…" : "Sign message"}
          </button>
          <button className="btn btn-glass" onClick={() => flow.setOpen(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NavButton({ onSignIn }: { onSignIn: () => void }) {
  const auth = useAuth();
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal }) => {
        if (!mounted || auth.status === "loading") return <WalletPlaceholder />;
        if (!account || auth.status !== "authenticated") {
          return (
            <button className="btn btn-primary btn-sm" onClick={onSignIn}>
              <WalletIcon />
              <span className={s.walletLabel}>{account ? "Sign in" : "Connect wallet"}</span>
            </button>
          );
        }
        if (CHAIN_CONFIGURED && chain?.unsupported) {
          return (
            <button className="btn btn-glass btn-sm" onClick={openChainModal}>
              Switch to {robinhoodChain?.name}
            </button>
          );
        }
        return (
          <button className={`btn btn-glass btn-sm ${s.account}`} onClick={openAccountModal} aria-label="Wallet account">
            <span className={s.avatar} aria-hidden="true" />
            <span className={s.walletLabel}>{account.ensName || shortAddress(account.address)}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function Wallet() {
  const flow = useSignInFlow();
  return (
    <>
      <NavButton onSignIn={flow.start} />
      <SignInDialog flow={flow} />
    </>
  );
}

export default function WalletButton() {
  const config = useMemo(() => makeWagmiConfig(appBaseUrl()), []);
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => {
    void loadSession();
  }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="wide" appInfo={{ appName: "Mochibo", disclaimer: Disclaimer, learnMoreUrl: "https://ethereum.org/en/wallets/" }}>
          <Wallet />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
