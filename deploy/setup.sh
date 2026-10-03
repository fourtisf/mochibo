#!/usr/bin/env bash
# First-time setup of the web app on a fresh Ubuntu VPS. Run as root, after the repo is
# cloned to /home/mochibo/app (see deploy/README.md):
#
#   EMAIL=you@example.com bash /home/mochibo/app/deploy/setup.sh
#
# Safe to run again. Installs Node, pnpm, PM2, Nginx and certbot, builds the app, starts it
# with PM2 (restarts on reboot), configures Nginx and gets a Let's Encrypt certificate.
set -euo pipefail

DOMAIN="${DOMAIN:-mochibo.studio}"
EMAIL="${EMAIL:?Set EMAIL=you@example.com (used for certificate expiry notices)}"
APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="10.28.0"

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
[ -f "$APP_DIR/package.json" ] || { echo "Repo not found at $APP_DIR. Clone it first (deploy/README.md)."; exit 1; }

# Ubuntu's automatic updates often hold the apt lock for a few minutes after boot. Wait for them.
wait_for_apt() {
  local waited=0
  while pgrep -x 'apt|apt-get|dpkg|unattended-upgr' >/dev/null || pgrep -f '/usr/bin/unattended-upgrade' >/dev/null; do
    [ $waited = 0 ] && echo "    Waiting for another apt/dpkg process (usually automatic updates) to finish..."
    sleep 5; waited=$((waited + 5))
    [ $waited -ge 1200 ] && { echo "Still locked after 20 minutes. Check: ps aux | grep -i apt"; exit 1; }
  done
}
APT="apt-get -o DPkg::Lock::Timeout=600"

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
# apt downloads can hang for hours on some VPS networks (often IPv6). Use IPv4 and time out.
printf 'Acquire::ForceIPv4 "true";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/99mochibo-network
wait_for_apt
$APT update -y
$APT install -y nginx certbot python3-certbot-nginx git curl ca-certificates ufw

echo "==> Node.js $NODE_MAJOR"
if ! node -v 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  wait_for_apt
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  wait_for_apt
  $APT install -y nodejs
fi
npm install -g "pnpm@$PNPM_VERSION" pm2

echo "==> Build"
sudo -u "$APP_USER" -H bash -c "
  set -e
  cd '$APP_DIR'
  echo 'NEXT_PUBLIC_APP_URL=https://$DOMAIN' > apps/web/.env.production.local
  pnpm install --frozen-lockfile
  pnpm build
"

echo "==> Start with PM2"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && pm2 startOrReload deploy/ecosystem.config.cjs && pm2 save"
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

echo "==> Nginx"
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
# Existing sites are left alone; this server block only answers for $DOMAIN and www.$DOMAIN.
nginx -t
systemctl reload nginx

echo "==> Firewall (SSH, HTTP, HTTPS)"
ufw allow OpenSSH >/dev/null
ufw allow "Nginx Full" >/dev/null
ufw --force enable >/dev/null

echo "==> HTTPS certificate"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo
echo "Done. Open https://$DOMAIN"
