#!/usr/bin/env bash
# Instalación en el VPS (Ubuntu + Nginx + PM2 + Certbot). Uso, desde la carpeta del proyecto:
#   sudo bash deploy/install.sh presupuestos.gesetecalderas.com
# Hace todo: chequea puertos, crea los .env con secretos y contraseñas nuevas, la base de datos (PostgreSQL del
# servidor o, si no hay, el contenedor de docker-compose), instala, compila, migra, carga los datos iniciales,
# arranca con PM2, agrega SOLO el sitio del presupuestador a Nginx (nginx -t antes de recargar) y pide el HTTPS.
# No toca los otros sitios ni sus procesos. Se puede volver a correr sin problema.
set -euo pipefail
DOMAIN="${1:-presupuestos.gesetecalderas.com}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${GESETEC_API_PORT:-4130}"; WEB_PORT="${GESETEC_WEB_PORT:-3130}"
# Las fotos van fuera del código: Nginx (www-data) no puede leer /root, donde vive el proyecto
UPLOADS_DIR="${GESETEC_UPLOADS_DIR:-/var/www/$DOMAIN/uploads}"
cd "$DIR"
say() { printf '\n\033[1;31m▸\033[0m %s\n' "$*"; }
rnd() { head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

say "Chequeando lo necesario"
for c in node npm pm2 nginx certbot ss curl; do command -v $c >/dev/null || { echo "✖ Falta $c en el servidor"; exit 1; }; done
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<20||(a===20&&b<18)){console.error("✖ Hace falta Node 20.18 o más (hay "+process.versions.node+")");process.exit(1)}'
for p in "$API_PORT" "$WEB_PORT"; do
  if ss -ltn "( sport = :$p )" | grep -q LISTEN && ! pm2 jlist 2>/dev/null | grep -q '"name":"gesetec-'; then
    echo "✖ El puerto $p ya lo usa otro sitio. Elegí otros: GESETEC_API_PORT=4140 GESETEC_WEB_PORT=3140 sudo -E bash deploy/install.sh $DOMAIN"; exit 1
  fi
done

CRED=""
if [ ! -f apps/api/.env ]; then
  say "Creando la base de datos y los .env"
  if sudo -u postgres psql -tAc 'select 1' >/dev/null 2>&1; then
    DB_PASS="$(rnd)"
    if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='gesetec'" | grep -q 1; then
      sudo -u postgres psql -qc "alter role gesetec with login password '$DB_PASS'"
    else
      sudo -u postgres psql -qc "create role gesetec with login password '$DB_PASS'"
    fi
    sudo -u postgres psql -tAc "select 1 from pg_database where datname='gesetec'" | grep -q 1 || sudo -u postgres createdb -O gesetec gesetec
    PG_PORT="$(sudo -u postgres psql -tAc 'show port' | tr -d ' ')"
    DB_URL="postgresql://gesetec:$DB_PASS@127.0.0.1:$PG_PORT/gesetec"
    echo "  PostgreSQL del servidor (puerto $PG_PORT), base gesetec"
  elif command -v docker >/dev/null; then
    docker compose up -d db
    DB_URL="postgresql://gesetec:gesetec@127.0.0.1:5434/gesetec"
    echo "  PostgreSQL en Docker (127.0.0.1:5434)"
    for i in $(seq 1 40); do docker compose exec -T db pg_isready -U gesetec >/dev/null 2>&1 && break; sleep 2; done
  else
    echo "✖ No hay PostgreSQL ni Docker en el servidor. Instalá uno de los dos (apt install postgresql) y volvé a correr."; exit 1
  fi
  ADMIN_PASS="Gesetec-$(rnd | head -c 8)"; VENTAS_PASS="Ventas-$(rnd | head -c 8)"
  sed -e "s#^DATABASE_URL=.*#DATABASE_URL=\"$DB_URL\"#" \
      -e "s#^PORT=.*#PORT=$API_PORT#" \
      -e "s#^\# HOST=.*#HOST=127.0.0.1#" \
      -e "s#^NODE_ENV=.*#NODE_ENV=production#" \
      -e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=https://$DOMAIN#" \
      -e "s#^PUBLIC_SITE_URL=.*#PUBLIC_SITE_URL=https://$DOMAIN#" \
      -e "s#^JWT_SECRET=.*#JWT_SECRET=$(rnd)$(rnd)#" \
      -e "s#^COOKIE_SECURE=.*#COOKIE_SECURE=true#" \
      -e "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=$ADMIN_PASS#" \
      -e "s#^VENTAS_PASSWORD=.*#VENTAS_PASSWORD=$VENTAS_PASS#" \
      -e "s#^UPLOADS_DIR=.*#UPLOADS_DIR=$UPLOADS_DIR#" \
      apps/api/.env.example > apps/api/.env
  sed -e "s#^API_URL=.*#API_URL=http://127.0.0.1:$API_PORT#" apps/web/.env.example > apps/web/.env.local
  chmod 600 apps/api/.env apps/web/.env.local
  CRED="  Leo: leo@gesetecalderas.com / $ADMIN_PASS
  Administración: administracion@gesetecalderas.com / $VENTAS_PASS"
fi

# La carpeta de fotos real es la del .env (en una instalación existente puede ser otra)
UPLOADS_DIR="$(grep -E '^UPLOADS_DIR=' apps/api/.env | cut -d= -f2- | tr -d '"' || true)"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
case "$UPLOADS_DIR" in /*) ;; *) UPLOADS_DIR="$DIR/apps/api/${UPLOADS_DIR#./}" ;; esac
mkdir -p "$UPLOADS_DIR"

say "Instalando dependencias"
npm ci --no-audit --no-fund
say "Compilando la API, migrando y cargando los datos iniciales"
npm run build -w apps/api
npm run db:migrate:prod -w apps/api
(cd apps/api && npx tsx src/db/seed.ts)   # no pisa nada si ya hay datos
# Nginx (www-data) sirve /uploads directo del disco: que pueda leer la carpeta de fotos
chmod a+x "$(dirname "$UPLOADS_DIR")" 2>/dev/null || true
chmod -R a+rX "$UPLOADS_DIR"

say "Compilando el panel"
API_URL="http://127.0.0.1:${API_PORT}" npm run build -w apps/web   # las rewrites de Next se fijan al compilar

say "Arrancando con PM2 (gesetec-api y gesetec-web)"
GESETEC_API_PORT=$API_PORT GESETEC_WEB_PORT=$WEB_PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

say "Nginx: sitio propio del presupuestador"
CONF=/etc/nginx/sites-available/gesetec-presupuestos
if [ ! -f "$CONF" ] || ! grep -q "managed by Certbot" "$CONF"; then
  sed -e "s#DOMINIO#$DOMAIN#g" -e "s#UPLOADS#$UPLOADS_DIR#g" -e "s#127.0.0.1:3130#127.0.0.1:$WEB_PORT#" -e "s#127.0.0.1:4130#127.0.0.1:$API_PORT#" deploy/nginx-presupuestos.conf > "$CONF"
  ln -sf "$CONF" /etc/nginx/sites-enabled/gesetec-presupuestos
fi
nginx -t && systemctl reload nginx

say "Certificado HTTPS"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  EMAIL_ARGS=(--register-unsafely-without-email); [ -n "${CERTBOT_EMAIL:-}" ] && EMAIL_ARGS=(-m "$CERTBOT_EMAIL")
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
    || echo "⚠ Certbot no pudo. Revisá que el DNS de $DOMAIN apunte a este servidor y corré: certbot --nginx -d $DOMAIN"
fi

sleep 3
api=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$API_PORT/api/health || true)
web=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$WEB_PORT/login || true)
echo
echo "✔ Presupuestador en https://$DOMAIN  (API: HTTP $api · panel: HTTP $web)"
if [ -n "$CRED" ]; then
  echo "  Usuarios (anotalos; se pueden cambiar en Administración → Usuarios):"
  echo "$CRED"
fi
