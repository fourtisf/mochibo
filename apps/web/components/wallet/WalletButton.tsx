"use client";
/**
 * Real wallet connection (RainbowKit on wagmi + viem) plus Sign-In with Ethereum: after connecting,
 * the wallet signs a one-time message (no gas) and the API sets an httpOnly session cookie.
 * Loaded lazily from the nav so the wallet libraries stay out of the first-load bundle.
 */
import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectButton,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  createAuthenticationAdapter,
  darkTheme,
  useConnectModal,
  type DisclaimerComponent,
  type Theme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const adapter = createAuthenticationAdapter({
  getNonce: async () => (await api<{ nonce: string }>("/auth/nonce")).nonce,
  createMessage: ({ nonce, address, chainId }) =>
    createSiweMessage({ domain: window.location.host, address, statement: STATEMENT, uri: window.location.origin, version: "1", chainId, nonce }),
  verify: async ({ message, signature }) => {
    try {
      const r = await api<{ address: string }>("/auth/verify", { method: "POST", body: JSON.stringify({ message, signature }) });
      authActions.signedIn(r.address);
      return true;
    } catch {
      return false;
    }
  },
  signOut: async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    authActions.signedOut();
  },
});

/** Lets the rest of the page open the wallet modal, and ends the session when the wallet disconnects or switches account. */
function AuthBridge() {
  const { openConnectModal } = useConnectModal();
  const { address, status } = useAccount();
  const auth = useAuth();
  const prev = useRef(status);
  useEffect(() => {
    authActions.registerOpener(openConnectModal ?? null);
    return () => authActions.registerOpener(null);
  }, [openConnectModal]);
  useEffect(() => {
    // Only a real disconnect counts: on page load the wallet starts as "disconnected" or "reconnecting".
    const disconnected = prev.current === "connected" && status === "disconnected";
    prev.current = status;
    if (auth.status !== "authenticated") return;
    if (disconnected || (status === "connected" && address && address.toLowerCase() !== auth.address)) void adapter.signOut();
  }, [auth, address, status]);
  return null;
}

function NavButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, authenticationStatus, openConnectModal, openAccountModal, openChainModal }) => {
        if (!mounted || authenticationStatus === "loading") return <WalletPlaceholder />;
        if (!account || authenticationStatus !== "authenticated") {
          return (
            <button className="btn btn-primary btn-sm" onClick={openConnectModal}>
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

export default function WalletButton() {
  const config = useMemo(() => makeWagmiConfig(appBaseUrl()), []);
  const [queryClient] = useState(() => new QueryClient());
  const { status } = useAuth();
  useEffect(() => {
    void loadSession();
  }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
          <RainbowKitProvider theme={theme} modalSize="wide" appInfo={{ appName: "Mochibo", disclaimer: Disclaimer, learnMoreUrl: "https://ethereum.org/en/wallets/" }}>
            <AuthBridge />
            <NavButton />
          </RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
