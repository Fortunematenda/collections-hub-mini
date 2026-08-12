#!/usr/bin/env bash
# Creates /var/www/collections-hub-mini and installs Collections Hub Mini.
# Run on the server as root (or with sudo):
#   curl -fsSL ... | bash
# or:
#   bash deploy/setup-server.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/collections-hub-mini}"
REPO_URL="${REPO_URL:-https://github.com/Fortunematenda/collections-hub-mini.git}"
APP_USER="${APP_USER:-www-data}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "==> App folder: $APP_DIR"
echo "==> Repo:       $REPO_URL"

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v git >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git
fi

mkdir -p "$(dirname "$APP_DIR")"

if [ -d "$APP_DIR/.git" ]; then
  echo "==> Updating existing clone"
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout main
  git -C "$APP_DIR" pull --ff-only origin main
else
  echo "==> Cloning into $APP_DIR"
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example (edit secrets next)"
  cp .env.example .env
  # Production: UI and API on same origin — leave VITE_API_URL empty
  sed -i 's|^VITE_API_URL=.*|VITE_API_URL=|' .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env || true
fi

echo "==> Installing dependencies"
npm ci

echo "==> Building frontend"
npm run build

echo "==> Installing systemd service"
install -m 644 deploy/collections-hub.service /etc/systemd/system/collections-hub.service
systemctl daemon-reload
systemctl enable collections-hub
systemctl restart collections-hub

if command -v nginx >/dev/null 2>&1; then
  echo "==> Nginx found — example config: $APP_DIR/deploy/nginx.example.conf"
  echo "    Copy it to /etc/nginx/sites-available/collections-hub and enable when ready."
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR" || true

echo ""
echo "Done."
echo "  Folder:  $APP_DIR"
echo "  Service: systemctl status collections-hub"
echo "  App URL: http://YOUR_SERVER_IP:8787  (or put Nginx/SSL in front)"
echo "  Next:    nano $APP_DIR/.env   # set SMTP, ADMIN_PASSWORD, Twilio"
echo "           systemctl restart collections-hub"
