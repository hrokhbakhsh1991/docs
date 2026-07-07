#!/usr/bin/env bash
# P10 — Production-grade gate (static; Profile C smoke via verification YAML)
# @see docs/phase-23/AGENT-START.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p10:gate — P9 regression (required every P10 PR) =="
pnpm run p9:gate

echo "== p10:gate — Profile C env static check =="
bash scripts/p10-profile-c-env-check.sh

echo "== p10:gate — P10 pack integrity =="
pnpm --filter @apps/api exec node --import tsx --test test/p10-pack-integrity.spec.ts

echo "P10_PRODUCTION_GRADE_GATE_OK"
