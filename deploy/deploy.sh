#!/usr/bin/env bash
# Zero-downtime-ish update: pull, install, migrate, build, reload PM2.
# Usage (on the server): cd /opt/glow && bash deploy/deploy.sh [branch]
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH=${1:-main}

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm build

if pm2 describe glow-api >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --env production
else
  pm2 start deploy/ecosystem.config.cjs --env production
fi

sleep 3
curl -fsS http://127.0.0.1:4420/api/health && echo
