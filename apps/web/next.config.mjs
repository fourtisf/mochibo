/** @type {import('next').NextConfig} */

// Framing is allowed only on embed routes (CLAUDE.md 5.7). The full CSP lands with the
// API in phase 2; frame-ancestors is set now so embeds work from day one.
const frameAll = [{ key: "Content-Security-Policy", value: "frame-ancestors *" }];
const frameSelf = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
    return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/:path*` }];
  },
  async headers() {
    return [
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
