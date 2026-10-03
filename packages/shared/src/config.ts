/**
 * Product-wide constants. Values that differ per environment (addresses, chain id,
 * feature flags) come from env vars and are read by the app or the API, not here.
 */

/** Working name. The final brand is not decided yet, so it lives in this one place. */
export const APP_NAME = "Mochibo";
/** Shown in the prototype's mock browser bar. Swap when the domain is decided. */
export const APP_DISPLAY_HOST = "mochibo.studio";
/** Holder token symbol shown in Rewards. The final ticker is not decided yet. */
export const TOKEN_SYMBOL = "MOCHIBO";

/** Credits are whole CR in config and UI, stored as centi-credits (1 CR = 100) in the DB. */
export const CENTI_PER_CREDIT = 100;

export const LIMITS = {
  nameMax: 32,
  instructionsMax: 2000,
  taskMax: 4000,
  skillsMax: 4,
  priceMin: 0,
  priceMax: 500,
} as const;

export const ECONOMICS = {
  /** Cost of a studio run of your own agent, in CR. Env RUN_COST_CR overrides on the server. */
  runCostCr: 5,
  /** Default platform fee in basis points (5%). Holder tiers lower it, see TIERS. */
  platformFeeBps: 500,
  /** Credits granted per 1 USDG deposited. */
  creditsPerUsdg: 100,
  /** Default price the studio suggests for a new agent, in CR. */
  defaultPriceCr: 12,
} as const;

export type TierId = "FREE" | "HOLDER" | "BUILDER" | "WHALE";

export interface Tier {
  id: TierId;
  name: string;
  /** Minimum tokens held, in whole tokens. */
  minHold: number;
  /** Short label for the tiers table. */
  holdLabel: string;
  /** Creator fee in basis points. */
  feeBps: number;
  rewards: string;
}

/** Holder tiers, lowest first. Keep fee numbers here only. */
export const TIERS: readonly Tier[] = [
  { id: "FREE", name: "Free", minHold: 0, holdLabel: "0", feeBps: 500, rewards: "None" },
  { id: "HOLDER", name: "Holder", minHold: 1_000_000, holdLabel: "1M", feeBps: 400, rewards: "Hourly" },
  { id: "BUILDER", name: "Builder", minHold: 5_000_000, holdLabel: "5M", feeBps: 250, rewards: "Hourly" },
  { id: "WHALE", name: "Whale", minHold: 20_000_000, holdLabel: "20M", feeBps: 0, rewards: "Hourly, boosted" },
];

export function tierForBalance(tokens: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (tokens >= tier.minHold) t = tier;
  return t;
}

/** "5%", "2.5%", "0%" */
export function formatBps(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

export const REWARDS = {
  /** Sample rate shown on the landing page: USD of tokenized stock per 1M tokens per hour. */
  samplePerMillionPerHour: 0.004,
  sampleAssets: ["NVDA", "TSLA", "AAPL"],
} as const;
