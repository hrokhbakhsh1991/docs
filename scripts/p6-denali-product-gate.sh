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
pnpm --filter @apps/api exec env STORAGE_DRIVER=memory NODE_ENV=test \
  node --import tsx --test --test-force-exit --test-concurrency=1 \
  test/p6-host-tenant-parity.spec.ts \
  test/p6-guest-slice.spec.ts \
  test/p6-offline-receipt-gate.spec.ts \
  test/p6-preservation-gate.spec.ts \
  test/bookings-ops.spec.ts \
  test/p6-member-receipt-flow.spec.ts \
  test/p6-vertical-slice-chain.spec.ts \
  test/p6-vs01-admin-publish.spec.ts \
  test/tour-publish-transition.spec.ts \
  test/marketing-catalog-revalidate.spec.ts \
  test/platform-denali-first-customer-exit.spec.ts

echo "== p6:gate — M17 public catalog guard =="
pnpm run guard:public-catalog-m17

echo "== p6:gate — portal member profile architecture (M4/M7) =="
pnpm run guard:portal-member-profile-boundary
pnpm run guard:architecture-truth

echo "== p6:gate — guest-surface-host + SDK catalog =="
pnpm --filter @app-tour/guest-surface-host run test
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test \
  test/resolve-catalog-list-features.spec.ts \
  test/resolve-catalog-detail-sections.spec.ts \
  test/resolve-catalog-registration-support.spec.ts \
  test/catalog-registration-dispatch.spec.ts \
  test/catalog-registration-dispatch.spec.ts \
  ../../packages/workspaces/denali/test/denali-catalog-transport-intake.spec.ts \
  test/registration-intake.contract.spec.ts \
  test/product-neutral-core.contract.spec.ts

echo "== p6:gate — API Denali registration (M16/M17 intake) =="
pnpm --filter @apps/api exec env STORAGE_DRIVER=memory NODE_ENV=test \
  node --import tsx --test --test-force-exit --test-concurrency=1 \
  test/denali-registration.spec.ts \
  test/identity-me.spec.ts

echo "== p6:gate — workspace-denali registration rules =="
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test \
  test/resolve-denali-registration-transport.spec.ts \
  test/denali-registration-validation.spec.ts

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
  test/portal-home-redirect.spec.ts \
  test/portal-catalog-registrations-dispatch.spec.ts \
  test/portal-catalog-registrations-bff.spec.ts \
  test/catalog-registration-intake-form-contract.spec.ts \
  test/public-catalog-registration-flow-contract.spec.ts \
  test/resolve-intake-defaults.spec.ts \
  test/portal-member-profile-bff.spec.ts

echo "== p6:gate — web redirect + finance nav =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/portal-registration-redirect.spec.ts \
  test/format-registration-intake.spec.ts \
  test/finance-page.spec.ts \
  test/finance-dashboard-widget.spec.ts

echo "P6_DENALI_PRODUCT_GATE_OK"
