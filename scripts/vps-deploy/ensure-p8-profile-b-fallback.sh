#!/usr/bin/env bash
# Idempotent — ensure PUBLIC_TENANT_FALLBACK_* on API env (Profile B).
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
api_env="${ENV_DIR}/api.env"
VPS_IP="${VPS_IP:-89.42.210.252}"
LABEL="${PUBLIC_TENANT_FALLBACK_LABEL:-denali}"

[[ -f "$api_env" ]] || {
  echo "ensure-p8-profile-b-fallback: missing $api_env" >&2
  exit 1
}

changed=0
if ! grep -qE '^PUBLIC_TENANT_FALLBACK_LABEL=' "$api_env" 2>/dev/null; then
  echo "PUBLIC_TENANT_FALLBACK_LABEL=${LABEL}" >>"$api_env"
  changed=1
fi
if ! grep -qE '^PUBLIC_TENANT_FALLBACK_HOSTS=' "$api_env" 2>/dev/null; then
  echo "PUBLIC_TENANT_FALLBACK_HOSTS=${VPS_IP},127.0.0.1" >>"$api_env"
  changed=1
fi

if [[ "$changed" -eq 1 ]]; then
  echo "ensure-p8-profile-b-fallback: updated $api_env — restart API"
else
  echo "ensure-p8-profile-b-fallback: OK"
fi
