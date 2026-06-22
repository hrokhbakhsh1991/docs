#!/usr/bin/env bash
# P6 — Denali first customer product gate
# @see docs/phase-19/platform-denali-vertical-slice.mdoc
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p6:gate — denali covenant =="
pnpm run guard:p3-denali-covenant

echo "== p6:gate — import boundary =="
pnpm run guard:import-boundary

echo "== p6:gate — tenant-kernel host =="
pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test \
  test/build-dev-portal-public-base-url.spec.ts \
  test/multi-level-host-parse.spec.ts

echo "== p6:gate — API P6 specs =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/p6-host-tenant-parity.spec.ts \
  test/p6-guest-slice.spec.ts \
  test/p6-offline-receipt-gate.spec.ts \
  test/p6-preservation-gate.spec.ts \
  test/bookings-ops.spec.ts \
  test/p6-member-receipt-flow.spec.ts \
  test/p6-vs01-admin-publish.spec.ts \
  test/platform-denali-first-customer-exit.spec.ts

echo "== p6:gate — marketing unit =="
pnpm --filter @apps/marketing exec node --import tsx --test \
  test/resolve-web-registration-url.spec.ts \
  test/guest-theme-stack.spec.ts

echo "== p6:gate — portal public-auth BFF =="
pnpm --filter @apps/portal exec node --import tsx --test \
  test/portal-public-auth-bff.spec.ts

echo "== p6:gate — portal unit =="
pnpm --filter @apps/portal exec node --import tsx --test \
  test/p6-theming-file-tree.spec.ts \
  test/guest-theme-stack.spec.ts \
  test/portal-host-bind.spec.ts \
  test/portal-member-registrations.spec.ts \
  test/portal-member-receipt-bff.spec.ts \
  test/portal-home-redirect.spec.ts

echo "== p6:gate — web redirect + finance nav =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/portal-registration-redirect.spec.ts \
  test/finance-page.spec.ts

echo "P6_DENALI_PRODUCT_GATE_OK"
