#!/usr/bin/env bash
# Phase 6 defensive guards — static AP14/AP15 bundle (no build/test/postgres).
# Used by phase-6:fast-track, phase-6-gate CI job, and local iteration.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== phase-6:defensive-guards =="

pnpm run guard:import-boundary
pnpm run guard:denali-plugin-surface
pnpm run guard:urban-plugin-surface
pnpm run guard:workspace-export-surface
pnpm run guard:api-workspace-isolation
bash scripts/guards/phase-eph-identity-ratchet.sh
pnpm run guard:field-policy-boundary
pnpm run guard:unbounded-list
pnpm run guard:repository-n-plus-one
pnpm run audit:findmany-scan
pnpm run guard:list-projection-openapi
pnpm run guard:catch-error-leak
pnpm run guard:repository-rls
pnpm run guard:bookings-getbyid-tenant-scope
pnpm run guard:service-n-plus-one
pnpm run guard:wrs-routing

echo "phase-6:defensive-guards: identity directory static specs"
pnpm --filter @apps/api exec node --import tsx --test \
  test/operator-avatar-batch.spec.ts \
  test/service-batch-patterns.spec.ts \
  test/identity-directory-pagination.spec.ts \
  test/bookings-member-summary-projection.spec.ts

pnpm run guard:wrs-stale-docs
pnpm run guard:pcms-authority
pnpm run guard:surface-cohesion
pnpm run guard:guest-plugin-conformance
pnpm run guard:workspace-onboard-contract
pnpm run guard:workspace-certification
pnpm run guard:admin-inline-color
pnpm run guard:todo-debt-budget
pnpm run phase-6:guard

echo "phase-6:defensive-guards: PASS"
