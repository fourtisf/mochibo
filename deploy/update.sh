#!/usr/bin/env bash
# Deploy the latest code. Run as root:  bash /home/mochibo/app/deploy/update.sh
set -euo pipefail
APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"
export PATH="/opt/mochibo-node/bin:$PATH"

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

# Always run the latest version of this script: pull first, then restart from the new copy.
if [ -z "${MOCHIBO_UPDATE_PULLED:-}" ]; then
  sudo -u "$APP_USER" -H git -C "$APP_DIR" pull --ff-only
  export MOCHIBO_UPDATE_PULLED=1
  exec bash "$APP_DIR/deploy/update.sh" "$@"
fi
# Redis, the API settings file and the /api route (installs them on servers set up before the API existed).
DOMAIN="${DOMAIN:-mochibo.studio}" APP_USER="$APP_USER" bash "$APP_DIR/deploy/api-setup.sh"

sudo -u "$APP_USER" -H env PATH="$PATH" bash -c "
  set -e
  cd '$APP_DIR'
  # Public settings are baked in at build time: app URL plus anything in ~/mochibo.env.
  { echo \"NEXT_PUBLIC_APP_URL=https://\${DOMAIN:-mochibo.studio}\"; [ -f ~/mochibo.env ] && cat ~/mochibo.env; true; } > apps/web/.env.production.local
  pnpm install --frozen-lockfile
  pnpm build
  pm2 startOrReload deploy/ecosystem.config.cjs
  pm2 save
"
echo "Updated. PM2 status:"
sudo -u "$APP_USER" -H env PATH="$PATH" pm2 status
