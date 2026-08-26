#!/usr/bin/env bash
# Regenerate RS256 AUTH_JWT_* when api.env still has placeholder/stub keys.
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_ENV="${ENV_DIR}/api.env"

[[ -f "$API_ENV" ]] || {
  echo "ensure-staging-jwt-keys: missing $API_ENV" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  grep -E "^${key}=" "$API_ENV" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
}

strip_quotes() {
  local val="$1"
  val="${val%\"}"
  val="${val#\"}"
  printf '%s' "$val"
}

private_key="$(strip_quotes "$(read_env_value AUTH_JWT_PRIVATE_KEY)")"
if [[ -n "$private_key" && ${#private_key} -ge 400 && "$private_key" != *'...'* ]]; then
  echo "ensure-staging-jwt-keys: existing RS256 private key OK (len=${#private_key})"
  exit 0
fi

echo "ensure-staging-jwt-keys: stub/placeholder JWT detected — generating RS256 pair"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${tmp_dir}/private.pem" 2>/dev/null
openssl rsa -in "${tmp_dir}/private.pem" -pubout -out "${tmp_dir}/public.pem" 2>/dev/null

pem_to_env_line() {
  local name="$1" file="$2"
  local escaped
  escaped="$(awk '{printf "%s\\n", $0}' "$file" | sed 's/\\n$//')"
  printf '%s="%s"\n' "$name" "$escaped"
}

public_line="$(pem_to_env_line AUTH_JWT_PUBLIC_KEY "${tmp_dir}/public.pem")"
private_line="$(pem_to_env_line AUTH_JWT_PRIVATE_KEY "${tmp_dir}/private.pem")"

tmp="$(mktemp)"
while IFS= read -r line; do
  case "$line" in
    AUTH_JWT_PUBLIC_KEY=*|AUTH_JWT_PRIVATE_KEY=*|AUTH_JWT_ISSUER=*|AUTH_JWT_AUDIENCE=*)
      continue
      ;;
  esac
  printf '%s\n' "$line"
done <"$API_ENV" >"$tmp"
{
  printf '%s\n' "$public_line" "$private_line"
  echo 'AUTH_JWT_ISSUER="tour-ops"'
  echo 'AUTH_JWT_AUDIENCE="tour-ops-api"'
} >>"$tmp"
mv "$tmp" "$API_ENV"
chmod 640 "$API_ENV"
chown root:app-tour "$API_ENV" 2>/dev/null || true
echo "ensure-staging-jwt-keys: updated $API_ENV"
