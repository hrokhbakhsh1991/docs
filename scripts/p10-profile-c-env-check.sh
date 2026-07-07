#!/usr/bin/env bash
# P10-1-N-002 — static Profile C env / edge header checks (no HTTPS required)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

rg -q "X-Forwarded-Proto|forwarded-proto" deploy/vps/caddy/Caddyfile -i || {
  echo "P10_PROFILE_C_ENV_FAIL: Caddyfile missing forwarded-proto" >&2
  exit 1
}

for f in deploy/vps/env/web.env.example deploy/vps/env/portal.env.example; do
  rg -q "SESSION_COOKIE_SECURE" "$f" || {
    echo "P10_PROFILE_C_ENV_FAIL: missing SESSION_COOKIE_SECURE in $f" >&2
    exit 1
  }
done

rg -q "127\\.0\\.0\\.1" deploy/vps/README.md docs/phase-23/p10-production-profile.yaml || {
  echo "P10_PROFILE_C_ENV_FAIL: loopback trust not documented" >&2
  exit 1
}

echo "P10_PROFILE_C_ENV_CHECK_OK"
