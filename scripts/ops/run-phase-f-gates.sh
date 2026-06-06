#!/usr/bin/env bash
# F-04…F-07 trunk ladder — live log via tee; abort on first gate failure.
# @see TEMP/phase1-aggressive-audit-fix-list.md
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
LOG="${ROOT}/TEMP/phase-f-gates.log"

export PATH="${PATH}"
: "${PHASE4_DB_PORT:=5434}"
: "${DATABASE_URL:=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db}"
: "${DATABASE_URL_ADMIN:=postgresql://postgres:postgres@127.0.0.1:5434/tour_db}"
: "${REDIS_URL:=redis://127.0.0.1:6379}"
export PHASE4_DB_PORT DATABASE_URL DATABASE_URL_ADMIN REDIS_URL
export NODE_ENV=test
export TENANT_MAX_CONCURRENT_DB_OPS="${TENANT_MAX_CONCURRENT_DB_OPS:-100}"
export TENANT_MAX_CONCURRENT_TOUR_WRITES="${TENANT_MAX_CONCURRENT_TOUR_WRITES:-100}"
export GLOBAL_HTTP_INFLIGHT_MAX="${GLOBAL_HTTP_INFLIGHT_MAX:-200}"

run_step() {
  local label="$1"
  shift
  echo ""
  echo "=== ${label} $(date -Iseconds) ==="
  "$@"
  echo "${label} PASS"
}

exec > >(tee "$LOG") 2>&1
echo "=== F ladder start $(date -Iseconds) ==="

run_step "F-04" pnpm run phase-2:gate
run_step "F-05" pnpm run phase-3:gate
export STORAGE_DRIVER=prisma
run_step "F-06a" pnpm --filter @apps/api run phase-4:resilience-regression-gate
run_step "F-06" pnpm run phase-4:gate
run_step "F-07" pnpm run test:full

echo "ALL_F_GATES_PASS $(date -Iseconds)"
echo "EXIT:0" >> "$LOG"
