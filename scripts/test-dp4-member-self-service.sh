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
    echo "[dp4] PASS $1"
  else
    echo "[dp4] FAIL $1"
    FAILED=$((FAILED + 1))
  fi
}

run_step "denali-policy" pnpm --filter @app-tour/workspace-denali exec -- env NODE_ENV=test node --import tsx --test \
  test/member-cancellation-policy.spec.ts

run_step "api-dp4" pnpm --filter @apps/api exec -- env NODE_ENV=test STORAGE_DRIVER=memory APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit --test-concurrency=1 \
  test/dp4/*.spec.ts

run_step "portal-dp4" pnpm --filter @apps/portal exec -- env NODE_ENV=test node --import tsx --test \
  test/portal-member-cancellation.spec.ts

run_step "dp1-regression" bash scripts/test-dp1-payment-deadline.sh

run_step "dp2-regression" bash scripts/test-dp2-operational-roster.sh

run_step "dp3-regression" bash scripts/test-dp3-tour-mutation.sh

run_step "guards" pnpm run pre-commit:fast && pnpm run guard:import-boundary

echo ""
echo "[dp4] finished with $FAILED failing layer(s)"
exit "$FAILED"
