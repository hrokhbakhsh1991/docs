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
    echo "[dp3] PASS $1"
  else
    echo "[dp3] FAIL $1"
    FAILED=$((FAILED + 1))
  fi
}

run_step "denali-mutation-policy" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/tour-mutation-policy.spec.ts

run_step "api-mutation-enforcement" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false PAYMENT_HOLD_ENABLED=true node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp3/tour-mutation-enforcement.spec.ts

run_step "publish-regression" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test \
  test/club-catalog-publish-service.spec.ts

run_step "booking" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test \
  test/bookings-create.spec.ts \
  test/bookings-safety.spec.ts

run_step "finance" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test \
  test/finance-registration-context.spec.ts

run_step "transport" pnpm --filter @apps/web exec -- env NODE_ENV=test node --import tsx --test \
  test/tours-workspace.spec.ts

run_step "architecture-isolation" pnpm run guard:import-boundary

run_step "pre-commit-fast" pnpm run pre-commit:fast

echo ""
echo "[dp3] finished with $FAILED failing layer(s)"
exit "$FAILED"
