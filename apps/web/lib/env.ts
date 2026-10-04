/** Public (browser-safe) env. Never put secrets in NEXT_PUBLIC_* vars. */
export const PUBLIC_ENV = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  tokenAddress: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "",
} as const;

/** Base URL for share and embed links. Falls back to the current origin in the browser. */
export function appBaseUrl(): string {
  if (PUBLIC_ENV.appUrl) return PUBLIC_ENV.appUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
