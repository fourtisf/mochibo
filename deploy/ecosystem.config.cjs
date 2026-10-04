/* PM2 processes: the web app and the API. The worker (chain indexer, jobs) comes with phase 3. */
const fs = require("node:fs");
const path = require("node:path");

// setup.sh and api-setup.sh pick free ports and store them here, so updates keep the same ones.
const readPort = (file, fallback) => {
  try {
    return fs.readFileSync(path.join(__dirname, file), "utf8").trim() || fallback;
  } catch {
    return fallback;
  }
};
const port = readPort(".web-port", "3000");
const apiPort = readPort(".api-port", "4000");
// Secret API settings (OpenRouter key, Redis password) live outside the repo, readable by the app user only.
const apiEnvFile = path.join(require("node:os").homedir(), "api.env");

module.exports = {
  apps: [
    {
      name: "web",
      cwd: path.join(__dirname, "../apps/web"),
      script: "node_modules/next/dist/bin/next",
      // Bound to localhost: only Nginx is reachable from outside.
      args: `start -p ${port} -H 127.0.0.1`,
      env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
      max_memory_restart: "800M",
    },
    {
      name: "api",
      cwd: path.join(__dirname, "../apps/api"),
      script: "dist/server.cjs",
      node_args: `--env-file=${apiEnvFile}`,
      env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: apiPort },
      max_memory_restart: "300M",
    },
  ],
};
