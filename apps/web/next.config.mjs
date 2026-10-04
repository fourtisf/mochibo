/** @type {import('next').NextConfig} */

// Framing is allowed only on embed routes (CLAUDE.md 5.7).
const frameAll = [{ key: "Content-Security-Policy", value: "frame-ancestors *" }];
const frameSelf = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

// The full content policy runs in report-only mode first: browsers log what it would block in the
// console (DevTools > Console) without breaking wallets. Switch the header name to
// Content-Security-Policy once production shows no reports for a week.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Wallet SDKs talk to their own HTTPS and WebSocket endpoints.
  `connect-src 'self' https: wss:${dev ? " ws:" : ""}`,
  "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const security = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@orbis/shared", "@orbis/characters"],
  webpack(config) {
    // Optional peers of the Coinbase SDK (x402 payments) that wagmi pulls in but we never use,
    // plus Node-only modules some wallet SDKs reference. Resolve them to empty modules.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // In development the API runs on its own port. In production Nginx sends /api to the API
  // before requests reach Next.js, so this rewrite is only a fallback.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
    return [
      { source: "/api/:path*", destination: `${api}/:path*` },
      { source: "/uploads/:name", destination: `${api}/uploads/:name` },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/embed/:path*", headers: frameAll },
      { source: "/((?!embed/).*)", headers: frameSelf },
      {
        source: "/characters/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
