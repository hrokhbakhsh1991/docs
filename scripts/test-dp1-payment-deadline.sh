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
    echo "[dp1] PASS $1"
  else
    echo "[dp1] FAIL $1 (expected until implementation)"
    FAILED=$((FAILED + 1))
  fi
}

run_step "finance-core" pnpm --filter @app-tour/finance-core exec -- env NODE_ENV=test node --import tsx --test \
  test/commercial-quote-freeze-on-approve.spec.ts \
  test/payment-hold-repository.contract.spec.ts

run_step "denali" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/resolve-denali-payment-deadline-hours.spec.ts \
  test/dp1-catalog-capacity-after-expiry.spec.ts

run_step "tour-core" pnpm --filter @app-tour/tour-core exec -- env NODE_ENV=test node --import tsx --test \
  test/dp1-approved-unpaid-occupancy.spec.ts

run_step "api" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp1/*.spec.ts

run_step "portal" pnpm --filter @apps/portal exec -- env NODE_ENV=test node --import tsx --test \
  test/portal-payment-deadline.spec.ts

run_step "operator-web" pnpm --filter @apps/web exec -- env NODE_ENV=test node --import tsx --test \
  test/bookings-payment-deadline.spec.ts

echo ""
echo "[dp1] finished with $FAILED failing layer(s)"
exit 0
