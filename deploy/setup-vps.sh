#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 VPS for Glow.
# Usage: sudo DOMAIN=app.example.com EMAIL=you@example.com REPO=git@github.com:you/glow.git bash deploy/setup-vps.sh
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. app.example.com}"
: "${EMAIL:?Set EMAIL for Let's Encrypt}"
: "${REPO:?Set REPO (git clone URL)}"
APP_DIR=${APP_DIR:-/opt/glow}
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -hex 16)}

echo "==> System packages"
apt-get update -y
apt-get install -y curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw

echo "==> Node.js 22 + pnpm + PM2"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* && "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
npm install -g pm2

echo "==> PostgreSQL"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='glow'" | grep -q 1 ||
  sudo -u postgres psql -c "CREATE ROLE glow LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='glow'" | grep -q 1 ||
  sudo -u postgres createdb -O glow glow

echo "==> Code"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.example apps/api/.env
  sed -i \
    -e "s|^NODE_ENV=.*|NODE_ENV=production|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://glow:${DB_PASSWORD}@localhost:5432/glow|" \
    -e "s|^PUBLIC_API_URL=.*|PUBLIC_API_URL=https://${DOMAIN}|" \
    -e "s|^WEB_APP_URL=.*|WEB_APP_URL=https://${DOMAIN}|" \
    -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN}|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^YOOKASSA_WEBHOOK_SECRET=.*|YOOKASSA_WEBHOOK_SECRET=$(openssl rand -hex 24)|" \
    -e "s|^DEV_AUTH_ENABLED=.*|DEV_AUTH_ENABLED=false|" \
    apps/api/.env
  echo "!! Fill BOT_TOKEN, BOT_USERNAME, PLATFORM_OWNER_TELEGRAM_ID and YooKassa keys in $APP_DIR/apps/api/.env"
fi
if [[ ! -f apps/web/.env ]]; then
  cp apps/web/.env.example apps/web/.env
  sed -i -e "s|^VITE_DEV_AUTH=.*|VITE_DEV_AUTH=false|" apps/web/.env
fi

echo "==> nginx + TLS"
mkdir -p /var/www/certbot
sed "s/app.example.com/${DOMAIN}/g" deploy/nginx/glow.conf > /etc/nginx/sites-available/glow.conf
ln -sf /etc/nginx/sites-available/glow.conf /etc/nginx/sites-enabled/glow.conf
rm -f /etc/nginx/sites-enabled/default
if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  # Issue the certificate with a temporary HTTP-only config, then enable the full one.
  cat > /etc/nginx/sites-enabled/glow.conf <<EOF
server { listen 80; server_name ${DOMAIN}; location /.well-known/acme-challenge/ { root /var/www/certbot; } }
EOF
  systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -m "$EMAIL" --agree-tos -n
  ln -sf /etc/nginx/sites-available/glow.conf /etc/nginx/sites-enabled/glow.conf
fi
nginx -t && systemctl reload nginx

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> First deploy"
bash deploy/deploy.sh
pm2 startup systemd -u root --hp /root >/dev/null
pm2 save

echo "Done. Open https://${DOMAIN}/api/health"
