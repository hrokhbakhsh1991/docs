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
    echo "[dp2] PASS $1"
  else
    echo "[dp2] FAIL $1"
    FAILED=$((FAILED + 1))
  fi
}

run_step "denali-domain" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/operational-roster-semantics.spec.ts \
  test/compose-tour-operational-roster.spec.ts

run_step "api" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false PAYMENT_HOLD_ENABLED=true node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp2/*.spec.ts

run_step "operator-web" pnpm --filter @apps/web exec -- env NODE_ENV=test node --import tsx --test \
  test/tour-workspace-operational-roster.spec.ts

echo ""
echo "[dp2] finished with $FAILED failing layer(s)"
exit "$FAILED"
