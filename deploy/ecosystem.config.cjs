/* PM2 processes. Phase 1 only has the web app; api and worker are added in phase 2. */
const fs = require("node:fs");
const path = require("node:path");

// setup.sh picks a free port and stores it here, so update.sh keeps using the same one.
let port = "3000";
try {
  port = fs.readFileSync(path.join(__dirname, ".web-port"), "utf8").trim() || port;
} catch {}

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
  ],
};
