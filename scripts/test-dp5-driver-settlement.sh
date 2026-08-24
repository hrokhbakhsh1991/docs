#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NODE_ENV=test
export STORAGE_DRIVER=memory

FAILED=0

run_step() {
  echo ""
  echo "======== $1 ========"
  shift
  if "$@"; then
    echo "[dp5] PASS $1"
  else
    echo "[dp5] FAIL $1"
    FAILED=$((FAILED + 1))
  fi
}

run_step "denali-domain" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/driver-settlement-calculation.spec.ts

run_step "api" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp5/*.spec.ts

run_step "import-boundary" pnpm run guard:import-boundary

run_step "operator-web" pnpm --filter @apps/web exec -- env NODE_ENV=test node --import tsx --test \
  test/dp5-driver-settlement-contract.spec.ts

echo ""
echo "[dp5] finished with $FAILED failing layer(s)"
exit "$FAILED"
