import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  bitgetWallet,
  braveWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { APP_NAME } from "@orbis/shared";
import { CHAINS } from "./chain";

/** WalletConnect (mobile wallets, QR codes) needs a free project id from cloud.reown.com. */
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export function makeWagmiConfig(appUrl: string) {
  const connectors = connectorsForWallets(
    [
      {
        groupName: "Popular",
        wallets: [metaMaskWallet, coinbaseWallet, rabbyWallet, okxWallet, phantomWallet, trustWallet, ...(WC_PROJECT_ID ? [walletConnectWallet] : [])],
      },
      { groupName: "More wallets", wallets: [rainbowWallet, bitgetWallet, binanceWallet, zerionWallet, braveWallet, injectedWallet] },
    ],
    { appName: APP_NAME, projectId: WC_PROJECT_ID || "mochibo-no-walletconnect", appUrl, appIcon: `${appUrl}/icon.png` },
  );
  return createConfig({
    chains: CHAINS,
    connectors,
    // Other installed wallets announce themselves (EIP-6963) and show up with their own logos.
    multiInjectedProviderDiscovery: true,
    transports: Object.fromEntries(CHAINS.map((c) => [c.id, http()])),
    ssr: false,
  });
}
