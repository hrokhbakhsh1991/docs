#!/usr/bin/env bash
# P6 — staging gate (product + Postgres finance-ops when DATABASE_URL set)
# @see docs/phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p6:staging-gate — product gate =="
pnpm run p6:gate

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "== p6:staging-gate — finance-ops (Postgres) =="
  pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
else
  echo "== p6:staging-gate — skip finance-ops (DATABASE_URL unset) =="
fi

echo "P6_STAGING_GATE_OK"
