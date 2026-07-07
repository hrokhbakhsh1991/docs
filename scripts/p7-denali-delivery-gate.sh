#!/usr/bin/env bash
# P7 — Denali customer live product gate (static; live smoke via p7:staging-verify)
# @see docs/phase-20/p7/AGENT-START.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p7:gate — P6 regression (required every P7 PR) =="
pnpm run p6:gate

echo "== p7:gate — P7 pack integrity =="
pnpm --filter @apps/api exec node --import tsx --test test/p7-pack-integrity.spec.ts

echo "P7_DENALI_DELIVERY_GATE_OK"
