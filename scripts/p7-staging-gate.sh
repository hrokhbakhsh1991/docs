#!/usr/bin/env bash
# P7 — staging gate (product + host smoke + Postgres finance when DATABASE_URL set)
# @see docs/phase-20/p7/runbooks/p7-staging-gate.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p7:staging-gate — staging verify (product + host smoke) =="
pnpm run p7:staging-verify

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "== p7:staging-gate — finance-ops (Postgres T3) =="
  if [[ "${DATABASE_URL}" == *"tour_db_staging"* ]]; then
    echo "  using VPS DATABASE_URL from api.env (skip local ensure-p6-finance-postgres)"
    unset DATABASE_URL_ADMIN
  else
    unset DATABASE_URL_ADMIN
    eval "$(bash scripts/ensure-p6-finance-postgres.sh)"
  fi
  pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
else
  echo "== p7:staging-gate — skip finance-ops (DATABASE_URL unset) =="
  echo "  export DATABASE_URL=postgresql://... for VS-07 T3 on staging Postgres"
fi

echo "P7_STAGING_GATE_OK"
