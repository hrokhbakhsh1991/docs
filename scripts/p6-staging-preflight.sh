#!/usr/bin/env bash
# P6 — staging preflight (Bundle C): product gate + optional Postgres finance-ops
# @see docs/phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p6:staging-preflight — product gate =="
pnpm run p6:gate

echo "== p6:staging-preflight — deploy wiring verify =="
bash scripts/p6-staging-deploy-verify.sh

if [[ -n "${DATABASE_URL:-}" ]] || [[ "${P6_FINANCE_OPS:-}" == "1" ]]; then
  echo "== p6:staging-preflight — finance-ops (Postgres) =="
  unset DATABASE_URL_ADMIN
  eval "$(bash scripts/ensure-p6-finance-postgres.sh)"
  pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
else
  echo "== p6:staging-preflight — skip finance-ops (set DATABASE_URL or P6_FINANCE_OPS=1) =="
fi

echo "== p6:staging-preflight — checklist =="
echo "  [ ] p6:e2e-gate green (browser smokes + P6-VS-CHAIN-B01)"
echo "  [ ] staging hosts match docs/phase-19/p6/runbooks/host-subdomain-map.md"
echo "  [ ] manual VS-06/07 on staging optional — first-customer-operator.md"

echo "P6_STAGING_PREFLIGHT_OK"
