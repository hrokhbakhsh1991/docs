#!/usr/bin/env bash
# Phase 15 holistic 90+ gate — Track W + Track P fast paths (<~3min, no Postgres/Playwright servers)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== P15 holistic grep (§7 checklist) =="
test "$(wc -l < apps/web/app/tours/new/denali-create-tour-wizard-client.tsx)" -lt 450
pnpm run generate:workspace-registry --check
DENALI_HARDCODE_COUNT="$(
  rg -c 'workspaceType === "denali"' apps/api/src 2>/dev/null | awk -F: '{s+=$2} END{print s+0}'
)"
test "${DENALI_HARDCODE_COUNT}" -lt 6

echo "== P15 Track W fast gate =="
pnpm run phase-15:wizard-fast-gate

echo "== P15 Track P fast gate =="
pnpm run phase-15:platform-fast-gate

cat <<'NOTE'

Phase 15 optional ops (require running dev stack — not part of fast gate):
  pnpm run smoke:denali-draft-unification
  pnpm run smoke:denali-draft-unification:on
  pnpm --filter @apps/web run test:e2e:urban

NOTE

echo "PHASE_15_90PLUS_OK"
