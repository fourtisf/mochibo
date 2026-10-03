#!/usr/bin/env bash
# Deploy the latest code. Run as root:  bash /home/mochibo/app/deploy/update.sh
set -euo pipefail
APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"

sudo -u "$APP_USER" -H bash -c "
  set -e
  cd '$APP_DIR'
  git pull --ff-only
  pnpm install --frozen-lockfile
  pnpm build
  pm2 reload deploy/ecosystem.config.cjs
  pm2 save
"
echo "Updated. PM2 status:"
sudo -u "$APP_USER" -H pm2 status
