/* PM2 processes. Phase 1 only has the web app; api and worker are added in phase 2. */
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "web",
      cwd: path.join(__dirname, "../apps/web"),
      script: "node_modules/next/dist/bin/next",
      // Bound to localhost: only Nginx is reachable from outside.
      args: "start -p 3000 -H 127.0.0.1",
      env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
      max_memory_restart: "800M",
    },
  ],
};
