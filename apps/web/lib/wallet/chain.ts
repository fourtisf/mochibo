import { defineChain, type Chain } from "viem";
import { mainnet } from "viem/chains";

/**
 * Robinhood Chain comes from env only (CLAUDE.md 5.1: take the values from the official docs,
 * never from memory). Until NEXT_PUBLIC_CHAIN_ID and NEXT_PUBLIC_RPC_URL are set, the app only
 * connects wallets (an address is the same on every EVM chain) and never asks to switch network.
 */
const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
const rpc = process.env.NEXT_PUBLIC_RPC_URL || "";
const explorer = process.env.NEXT_PUBLIC_EXPLORER_URL || "";

export const robinhoodChain: Chain | null =
  id && rpc
    ? defineChain({
        id,
        name: "Robinhood Chain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
        ...(explorer ? { blockExplorers: { default: { name: "Explorer", url: explorer } } } : {}),
      })
    : null;

/** True when the app knows the target chain and should ask wallets to switch to it. */
export const CHAIN_CONFIGURED = robinhoodChain !== null;

export const CHAINS: readonly [Chain, ...Chain[]] = robinhoodChain ? [robinhoodChain] : [mainnet];
