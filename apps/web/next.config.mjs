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
