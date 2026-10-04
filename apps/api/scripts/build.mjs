// Bundles the API into dist/server.cjs (CommonJS, which PM2 runs everywhere). @orbis/shared (TypeScript source) is bundled in;
// npm dependencies stay external and load from node_modules.
import { build, context } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith("@orbis/"));
const options = {
  entryPoints: { server: "src/server.ts", reconcile: "src/reconcile-cli.ts" },
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external,
  logLevel: "info",
};
if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
