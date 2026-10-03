#!/usr/bin/env bash
# Checks everything setup.sh needs, in one pass, before anything is changed. Run as root:
#
#   bash /home/mochibo/app/deploy/preflight.sh          # report only
#   FIX=1 bash /home/mochibo/app/deploy/preflight.sh    # also apply the safe fixes
#
# Safe fixes: fallback DNS resolvers (1.1.1.1, 8.8.8.8) when lookups fail, and a 2 GB swap
# file when the server has under 2 GB of RAM and no swap (the Next.js build needs memory).
# Exits non-zero if anything is still blocking.
set -uo pipefail

DOMAIN="${DOMAIN:-mochibo.studio}"
FIX="${FIX:-0}"
FAILS=0
ok() { printf '  \033[32mOK\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; }
bad() { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILS=$((FAILS + 1)); }

# Hosts the setup downloads from. Node.js needs either the first or the mirror.
HOSTS="github.com registry.npmjs.org fonts.googleapis.com fonts.gstatic.com acme-v02.api.letsencrypt.org"
NODE_HOSTS="nodejs.org npmmirror.com"

resolves() { getent ahosts "$1" >/dev/null 2>&1; }
reachable() { curl -fsS -o /dev/null --max-time 15 --retry 2 --retry-all-errors "https://$1/" 2>/dev/null || curl -sS -o /dev/null --max-time 15 -w '%{http_code}' "https://$1/" 2>/dev/null | grep -qE '^[1-5][0-9][0-9]$'; }

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

echo "== DNS"
dns_fail=""
for h in $HOSTS $NODE_HOSTS; do resolves "$h" || dns_fail="$dns_fail $h"; done
if [ -n "$dns_fail" ] && [ "$FIX" = 1 ]; then
  echo "  Lookups failed for:$dns_fail. Adding fallback resolvers 1.1.1.1 and 8.8.8.8."
  mkdir -p /etc/systemd/resolved.conf.d
  printf '[Resolve]\nDNS=1.1.1.1 8.8.8.8\nFallbackDNS=1.0.0.1 8.8.4.4\n' > /etc/systemd/resolved.conf.d/mochibo-dns.conf
  systemctl restart systemd-resolved 2>/dev/null || true
  sleep 2
  dns_fail=""
  for h in $HOSTS $NODE_HOSTS; do resolves "$h" || dns_fail="$dns_fail $h"; done
fi
# Lookup results are informational: some resolvers fail getent (NSS) but curl still connects.
# The HTTPS checks below are what decide.
for h in $HOSTS $NODE_HOSTS; do case " $dns_fail " in *" $h "*) warn "getent cannot resolve $h (checked over HTTPS below)";; *) ok "resolves $h";; esac; done

echo "== HTTPS access"
for h in $HOSTS; do reachable "$h" && ok "https://$h" || bad "cannot connect to https://$h"; done
node_net=0
for h in $NODE_HOSTS; do if reachable "$h"; then ok "https://$h"; node_net=1; else warn "cannot connect to https://$h"; fi; done
[ $node_net = 1 ] || bad "no Node.js download source is reachable"

echo "== Domain"
myips="$(hostname -I 2>/dev/null)"
for d in "$DOMAIN" "www.$DOMAIN"; do
  ip="$(getent ahostsv4 "$d" 2>/dev/null | awk 'NR==1{print $1}')"
  if [ -z "$ip" ]; then bad "$d does not resolve (add the DNS record)"
  elif echo " $myips " | grep -q " $ip "; then ok "$d -> $ip (this server)"
  else bad "$d -> $ip, but this server is: $myips"; fi
done

echo "== Nginx"
if command -v nginx >/dev/null; then
  nginx -t >/dev/null 2>&1 && ok "existing Nginx config is valid" || bad "nginx -t fails on the existing config: run 'nginx -t' to see why"
  clash="$(grep -RlsE "server_name[^;]*[[:space:]](www\.)?${DOMAIN//./\\.}([[:space:];])" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v "/$DOMAIN\$" || true)"
  [ -z "$clash" ] && ok "no other site claims $DOMAIN" || bad "another Nginx site already uses $DOMAIN: $clash"
  others="$(ls /etc/nginx/sites-enabled 2>/dev/null | grep -v "^$DOMAIN\$" | tr '\n' ' ')"
  [ -n "$others" ] && warn "other sites on this server (left untouched): $others"
else
  ok "Nginx not installed yet (setup installs it)"
fi
owner="$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2)"
[ -z "$owner" ] || [ "$owner" = nginx ] && ok "port 80 free or used by Nginx" || bad "port 80 is used by '$owner', not Nginx"

echo "== Resources"
mem_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo)
avail_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
if [ $((avail_mb + swap_mb)) -lt 2048 ]; then
  if [ "$FIX" = 1 ] && [ "$swap_mb" = 0 ] && [ ! -e /swapfile ]; then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "added a 2 GB swap file for the build (RAM ${mem_mb} MB)"
  else
    warn "only ${avail_mb} MB RAM free and ${swap_mb} MB swap; the build may run out of memory"
  fi
else
  ok "memory: ${avail_mb} MB free of ${mem_mb} MB, swap ${swap_mb} MB"
fi
disk_mb=$(df -Pm / | awk 'NR==2{print $4}')
[ "$disk_mb" -ge 3072 ] && ok "disk: ${disk_mb} MB free" || bad "disk: only ${disk_mb} MB free (need 3 GB)"

echo "== Package manager"
if pgrep -x 'apt|apt-get|dpkg|unattended-upgr' >/dev/null || pgrep -f '/usr/bin/unattended-upgrade' >/dev/null; then
  warn "another apt/dpkg process is running; setup waits for it (up to 20 minutes)"
else
  ok "apt is free"
fi

echo
if [ $FAILS -gt 0 ]; then
  echo "$FAILS blocking problem(s) above. Nothing was installed."
  exit 1
fi
echo "All checks passed."
