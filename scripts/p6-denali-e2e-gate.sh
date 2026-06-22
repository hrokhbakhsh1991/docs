#!/usr/bin/env bash
# P6 — E2E gate stub (Architect YES for full browser runs)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p6:e2e-gate — see docs/phase-19/p6/runbooks/p6-e2e-smoke.md =="
echo "  pnpm --filter @apps/portal run test:smoke    # SMK-PTL-01"
echo "  pnpm --filter @apps/marketing run test:smoke # SMK-MKT-03"
echo "  node scripts/smoke-p6-host-bind.mjs          # SMK-P6-HOST-01"
echo "P6_E2E_GATE_STUB_OK"
