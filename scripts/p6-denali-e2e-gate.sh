#!/usr/bin/env bash
# P6 — E2E gate (browser + product gate)
# @see docs/phase-19/p6/runbooks/p6-e2e-smoke.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PW_NO_REUSE_SERVER=1

echo "== p6:e2e-gate — product gate =="
pnpm run p6:gate

echo "== p6:e2e-gate — VS-01 admin publish (SMK-P6-VS-01) =="
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-VS-01"

echo "== p6:e2e-gate — portal smoke (VS-03..05) =="
pnpm --filter @apps/portal run test:smoke

echo "== p6:e2e-gate — marketing smoke (VS-02..03) =="
pnpm --filter @apps/marketing run test:smoke

echo "== p6:e2e-gate — VS-07 operator approve receipt (SMK-P6-ADM-02) =="
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-ADM-02"

echo "== p6:e2e-gate — VS-06 operator approve booking (SMK-P9-04) =="
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P9-04"

echo "P6_E2E_GATE_OK"
