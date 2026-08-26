#!/usr/bin/env bash
# Lightweight MinIO read/write probe for staging (mc preferred; no pnpm on VPS).
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_ENV="${ENV_DIR}/api.env"

[[ -f "$API_ENV" ]] || {
  echo "probe-staging-minio: missing $API_ENV" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$API_ENV"
set +a

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT required}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY required}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY required}"
BUCKET="${MINIO_BUCKET:-app-tour-staging}"

if ! command -v mc >/dev/null 2>&1; then
  echo "probe-staging-minio: minio client (mc) not installed — install via bootstrap-staging or apt install minio-client" >&2
  exit 1
fi

ALIAS="staging-artifact-probe-$$"
mc alias set "$ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
trap 'mc alias rm "$ALIAS" >/dev/null 2>&1 || true' EXIT

mc ls "${ALIAS}/${BUCKET}" >/dev/null
KEY="artifact-probe-$(date +%s).txt"
echo ok | mc pipe "${ALIAS}/${BUCKET}/${KEY}" >/dev/null
test "$(mc cat "${ALIAS}/${BUCKET}/${KEY}")" = "ok"
mc rm "${ALIAS}/${BUCKET}/${KEY}" >/dev/null
echo "MINIO_PROBE_OK bucket=${BUCKET}"
