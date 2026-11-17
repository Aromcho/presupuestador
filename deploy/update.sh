#!/usr/bin/env bash
# Actualizar el código en el VPS sin cortar el servicio: bash deploy/update.sh
# (no toca los .env, la base ni las fotos subidas)
set -euo pipefail
cd "$(dirname "$0")/.."
API_PORT="${GESETEC_API_PORT:-4130}"; WEB_PORT="${GESETEC_WEB_PORT:-3130}"
npm ci --no-audit --no-fund
npm run build -w apps/api
npm run db:migrate:prod -w apps/api
API_URL="http://127.0.0.1:${API_PORT}" NEXT_DIST_DIR=.next-new npm run build -w apps/web   # compila al costado
rm -rf apps/web/.next-old && { [ -d apps/web/.next ] && mv apps/web/.next apps/web/.next-old || true; } && mv apps/web/.next-new apps/web/.next
GESETEC_API_PORT=$API_PORT GESETEC_WEB_PORT=$WEB_PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env
echo "✔ Actualizado"
