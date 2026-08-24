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
    echo "[dp6] PASS $1"
  else
    echo "[dp6] FAIL $1"
    FAILED=$((FAILED + 1))
  fi
}

run_step "denali-refund-eligibility" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/refund-eligibility.spec.ts

run_step "api-dp6" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false PAYMENT_HOLD_ENABLED=true PAYMENT_HOLD_EXPIRY_ENABLED=true node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp6/*.spec.ts

run_step "finance-refund-regression" pnpm --filter @app-tour/finance-core exec -- env NODE_ENV=test node --import tsx --test \
  test/refund-domain-pr23e2.spec.ts

run_step "dp4-regression" bash scripts/test-dp4-member-self-service.sh

run_step "dp5-regression" bash scripts/test-dp5-driver-settlement.sh

run_step "dp1-regression" bash scripts/test-dp1-payment-deadline.sh

run_step "guards" pnpm run pre-commit:fast && pnpm run guard:import-boundary

echo ""
echo "[dp6] finished with $FAILED failing layer(s)"
exit "$FAILED"
