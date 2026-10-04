#!/usr/bin/env bash
# First-time setup of the web app on a fresh Ubuntu VPS. Run as root, after the repo is
# cloned to /home/mochibo/app (see deploy/README.md):
#
#   EMAIL=you@example.com bash /home/mochibo/app/deploy/setup.sh
#
# Safe to run again. Installs Node, pnpm, PM2, Nginx, certbot and Redis, builds the web app and
# the API, starts both with PM2 (restarts on reboot), configures Nginx and gets a Let's Encrypt
# certificate.
set -euo pipefail

DOMAIN="${DOMAIN:-mochibo.studio}"
EMAIL="${EMAIL:?Set EMAIL=you@example.com (used for certificate expiry notices)}"
APP_USER="${APP_USER:-mochibo}"
APP_DIR="/home/$APP_USER/app"
NODE_MAJOR="${NODE_MAJOR:-22}"
# Private Node.js for this app only, so other apps on the server keep their own Node version.
NODE_DIR="/opt/mochibo-node"
PNPM_VERSION="10.28.0"

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
[ -f "$APP_DIR/package.json" ] || { echo "Repo not found at $APP_DIR. Clone it first (deploy/README.md)."; exit 1; }

# Always run the latest version of this script: pull first, then restart from the new copy.
if [ -z "${MOCHIBO_SETUP_PULLED:-}" ]; then
  echo "==> Getting the latest code"
  sudo -u "$APP_USER" -H git -C "$APP_DIR" pull --ff-only || { echo "git pull failed (see above)."; exit 1; }
  echo "    Now at: $(sudo -u "$APP_USER" -H git -C "$APP_DIR" log -1 --format='%h %s')"
  export MOCHIBO_SETUP_PULLED=1
  exec bash "$APP_DIR/deploy/setup.sh" "$@"
fi

echo "==> Preflight (checks everything first; fixes DNS and swap if needed)"
FIX=1 DOMAIN="$DOMAIN" bash "$APP_DIR/deploy/preflight.sh" || { echo; echo "Fix the problems above, then run setup again."; exit 1; }
echo

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
# Third-party sources added by other apps can fail (for example, an expired signing key).
# The Ubuntu sources are what we need, so a partial failure is not fatal.
$APT update -y || echo "    Some package sources failed to update (see above). Continuing with the current package lists."
$APT install -y nginx certbot python3-certbot-nginx git curl ca-certificates ufw xz-utils redis-server postgresql openssl

echo "==> Node.js $NODE_MAJOR (private copy in $NODE_DIR)"
if ! "$NODE_DIR/bin/node" -v 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64) ARCH=arm64 ;;
    *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;;
  esac
  # nodejs.org first; a public mirror with the same layout if this server cannot reach it.
  SUMS=""
  for BASE in "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x" "https://npmmirror.com/mirrors/node/latest-v${NODE_MAJOR}.x"; do
    if SUMS="$(curl -fsSL --retry 4 --retry-delay 3 --retry-all-errors "$BASE/SHASUMS256.txt")"; then break; fi
    echo "    Could not reach $BASE, trying the next source..."
    SUMS=""
  done
  [ -n "$SUMS" ] || { echo "Could not download Node.js. Check DNS: getent hosts nodejs.org"; exit 1; }
  TARBALL="$(echo "$SUMS" | awk '{print $2}' | grep -E "^node-v[0-9.]+-linux-$ARCH\.tar\.xz$")"
  TMP="$(mktemp -d)"
  curl -fsSL --retry 4 --retry-delay 3 --retry-all-errors "$BASE/$TARBALL" -o "$TMP/$TARBALL"
  (cd "$TMP" && echo "$SUMS" | grep " $TARBALL\$" | sha256sum -c - >/dev/null)
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf "$TMP/$TARBALL" -C "$NODE_DIR" --strip-components=1
  rm -rf "$TMP"
fi
export PATH="$NODE_DIR/bin:$PATH"
echo "    $(node -v)"
npm install -g --silent "pnpm@$PNPM_VERSION" pm2

echo "==> Pick a free local port for the web app (other apps may already use 3000)"
PORT_FILE="$APP_DIR/deploy/.web-port"
WEB_PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
if [ -z "$WEB_PORT" ]; then
  for p in 3000 3100 3200 3300 3400 3500; do
    if ! ss -ltnH "sport = :$p" | grep -q .; then WEB_PORT=$p; break; fi
  done
  [ -n "$WEB_PORT" ] || { echo "No free port found in 3000-3500."; exit 1; }
  echo "$WEB_PORT" > "$PORT_FILE"; chown "$APP_USER:$APP_USER" "$PORT_FILE"
fi
echo "    Using 127.0.0.1:$WEB_PORT"

echo "==> Build"
sudo -u "$APP_USER" -H env PATH="$PATH" bash -c "
  set -e
  cd '$APP_DIR'
  { echo 'NEXT_PUBLIC_APP_URL=https://$DOMAIN'; [ -f /home/$APP_USER/mochibo.env ] && cat /home/$APP_USER/mochibo.env; true; } > apps/web/.env.production.local
  pnpm install --frozen-lockfile
  pnpm build
"

echo "==> API: private Redis, settings file, port and the /api route"
DOMAIN="$DOMAIN" APP_USER="$APP_USER" bash "$APP_DIR/deploy/api-setup.sh"

echo "==> Database migrations"
sudo -u "$APP_USER" -H env PATH="$PATH" bash -c "cd '$APP_DIR' && DATABASE_URL=\"\$(grep -E '^DATABASE_URL=' ~/api.env | cut -d= -f2-)\" pnpm --filter @orbis/api db:migrate"

echo "==> Start with PM2"
sudo -u "$APP_USER" -H env PATH="$PATH" bash -c "cd '$APP_DIR' && pm2 startOrReload deploy/ecosystem.config.cjs && pm2 save"
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

echo "==> Nginx"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$WEB_PORT/g" "$APP_DIR/deploy/nginx.conf" > "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
# Existing sites are left alone; this server block only answers for $DOMAIN and www.$DOMAIN.
nginx -t
systemctl reload nginx

echo "==> Firewall"
if ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null
  ufw allow "Nginx Full" >/dev/null
  echo "    ufw is active: allowed SSH, HTTP and HTTPS"
else
  echo "    ufw is not active; left unchanged (other services on this server may need other ports)"
fi

echo "==> HTTPS certificate"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo
echo "Done. Open https://$DOMAIN"
