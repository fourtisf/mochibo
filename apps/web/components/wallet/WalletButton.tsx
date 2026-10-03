"use client";
/**
 * Real wallet connection (RainbowKit on wagmi + viem). Loaded lazily from the nav so the wallet
 * libraries stay out of the first-load bundle. Sign-In with Ethereum (session cookie) arrives
 * with the API in phase 2: this only connects the wallet and shows the address.
 */
import "@rainbow-me/rainbowkit/styles.css";
import { useMemo, useState } from "react";
import { ConnectButton, RainbowKitProvider, darkTheme, type DisclaimerComponent, type Theme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
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

function NavButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => {
        if (!mounted) return <WalletPlaceholder />;
        if (!account) {
          return (
            <button className="btn btn-primary btn-sm" onClick={openConnectModal}>
              <WalletIcon />
              <span className={s.walletLabel}>Connect wallet</span>
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
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="wide" appInfo={{ appName: "Mochibo", disclaimer: Disclaimer, learnMoreUrl: "https://ethereum.org/en/wallets/" }}>
          <NavButton />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
