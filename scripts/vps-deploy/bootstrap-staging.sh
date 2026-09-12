#!/usr/bin/env bash
# One-time / idempotent P6 staging wiring on VPS (no pnpm install/build).
# @see docs/phase-19/p6/runbooks/p6-staging-vps-boundary.md
# Long steps (install, build, gates): TEMP/FOR YOU.md
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
PROD_ENV="${PROD_ENV:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"
VPS_IP="${VPS_IP:-89.42.210.252}"

log() { printf '[bootstrap-staging] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "bootstrap-staging: run as root" >&2
  exit 1
}

[[ -d "$DEPLOY_PATH" ]] || {
  echo "bootstrap-staging: missing $DEPLOY_PATH — rsync DEV first (TEMP/FOR YOU.md §C)" >&2
  exit 1
}

[[ -f "$PROD_ENV/api.env" ]] || {
  echo "bootstrap-staging: missing prod $PROD_ENV/api.env" >&2
  exit 1
}

log "env dir $ENV_DIR"
mkdir -p "$ENV_DIR"
chmod 750 "$ENV_DIR"
chown root:"$APP_USER" "$ENV_DIR"

if [[ ! -f "$ENV_DIR/api.env" ]]; then
  sed -e 's/tour_db_prod/tour_db_staging/g' \
      -e 's/app-tour-prod/app-tour-staging/g' \
      -e 's/^PORT=13001/PORT=23001/' \
      -e 's|^PORT=3001|PORT=23001|' \
      -e 's|redis://127.0.0.1:6379/1|redis://127.0.0.1:6379/2|' \
      -e 's/APP_INFRA_PROFILE=production/APP_INFRA_PROFILE=staging/' \
      -e 's/^NODE_ENV=production/NODE_ENV=development/' \
      "$PROD_ENV/api.env" >"$ENV_DIR/api.env"
  grep -q PUBLIC_TENANT_FALLBACK_LABEL "$ENV_DIR/api.env" || {
    echo "PUBLIC_TENANT_FALLBACK_LABEL=denali" >>"$ENV_DIR/api.env"
    echo "PUBLIC_TENANT_FALLBACK_HOSTS=${VPS_IP},127.0.0.1" >>"$ENV_DIR/api.env"
  }
fi

if [[ ! -f "$ENV_DIR/web.env" ]]; then
  sed -e 's/^PORT=13000/PORT=23000/' \
      -e 's/^PORT=3000/PORT=23000/' \
      -e 's/127.0.0.1:13001/127.0.0.1:23001/g' \
      -e 's/127.0.0.1:3001/127.0.0.1:23001/g' \
      "$PROD_ENV/web.env" >"$ENV_DIR/web.env"
  grep -q TOUR_OPS_DEFAULT_TENANT_ID "$ENV_DIR/web.env" || \
    echo "TOUR_OPS_DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000003" >>"$ENV_DIR/web.env"
  grep -q TOUR_OPS_PUBLIC_FALLBACK_HOSTS "$ENV_DIR/web.env" || \
    echo "TOUR_OPS_PUBLIC_FALLBACK_HOSTS=${VPS_IP},127.0.0.1" >>"$ENV_DIR/web.env"
fi

for pair in marketing:23002:marketing.env.example portal:23003:portal.env.example; do
  app="${pair%%:*}"
  rest="${pair#*:}"
  port="${rest%%:*}"
  example="${rest#*:}"
  target="$ENV_DIR/${app}.env"
  if [[ ! -f "$target" ]]; then
    sed -e "s/^PORT=300[23]/PORT=${port}/" \
        -e 's/127.0.0.1:3001/127.0.0.1:23001/g' \
        "$DEPLOY_PATH/deploy/vps/env/$example" >"$target"
    echo "ALLOW_DEV_WEB_SESSION=true" >>"$target"
    echo "TOUR_OPS_DEV_TENANT_ID=00000000-0000-4000-8000-000000000003" >>"$target"
    echo "TOUR_OPS_PUBLIC_FALLBACK_HOSTS=${VPS_IP},127.0.0.1" >>"$target"
  fi
done

grep -qE '^MINIO_PUBLIC_ENDPOINT=' "$ENV_DIR/api.env" 2>/dev/null || \
  echo "MINIO_PUBLIC_ENDPOINT=http://${VPS_IP}:9002" >>"$ENV_DIR/api.env"
if [[ -f "$ENV_DIR/portal.env" ]]; then
  grep -qE '^PORTAL_INTERNAL_URL=' "$ENV_DIR/portal.env" 2>/dev/null || \
    echo "PORTAL_INTERNAL_URL=http://127.0.0.1:23003" >>"$ENV_DIR/portal.env"
fi

chmod 640 "$ENV_DIR"/*.env
chown root:"$APP_USER" "$ENV_DIR"/*.env

log "database tour_db_staging"
set -a
# shellcheck disable=SC1090
source "$PROD_ENV/api.env"
set +a
if ! sudo -u postgres psql -p 5433 -tAc "SELECT 1 FROM pg_database WHERE datname='tour_db_staging'" | grep -q 1; then
  sudo -u postgres psql -p 5433 -c "CREATE DATABASE tour_db_staging OWNER app_tour;"
fi

if command -v mc >/dev/null 2>&1; then
  mc alias set vpsminio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1 || true
  mc mb "vpsminio/app-tour-staging" --ignore-existing >/dev/null 2>&1 || true
fi

chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

DEPLOY_PATH="$DEPLOY_PATH" ENV_DIR="$ENV_DIR" UNIT_PREFIX="$UNIT_PREFIX" \
  bash "$DEPLOY_PATH/scripts/vps-deploy/install-systemd-units.sh"

if [[ ! -f "$ENV_DIR/README" ]]; then
  cat >"$ENV_DIR/README" <<EOF
# P6 staging — DO NOT EDIT PRODUCTION
# Production: /etc/app-tour + /opt/app-tour + :13000/:13001 + tour_db_prod
# Staging:    $DEPLOY_PATH + :23000-23003 + tour_db_staging
# See docs/phase-19/p6/runbooks/p6-staging-vps-boundary.md
EOF
fi

ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/verify-env-coherence.sh"

log "OK — next: TEMP/FOR YOU.md §D (install/build/migrate) then systemctl restart ${UNIT_PREFIX}-*"
echo "BOOTSTRAP_STAGING_OK"
