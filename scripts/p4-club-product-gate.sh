#!/usr/bin/env bash
# P4 — Club Product Surfaces fast gate
# @see docs/phase-17/platform-club-product-e2e.mdoc
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p4:gate — import boundary =="
pnpm run guard:import-boundary

echo "== p4:gate — public catalog M17 =="
pnpm run guard:public-catalog-m17

echo "== p4:gate — guest-surface-host + SDK catalog =="
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

echo "== p4:gate — API Denali registration (M16/M17 intake) =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/denali-registration.spec.ts \
  test/identity-me.spec.ts

echo "== p4:gate — workspace-denali registration rules =="
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test \
  test/resolve-denali-registration-transport.spec.ts \
  test/denali-registration-validation.spec.ts

echo "== p4:gate — denali covenant =="
pnpm run guard:p3-denali-covenant

echo "== p4:gate — API catalog specs =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/marketing-catalog-revalidate.spec.ts \
  test/club-catalog-publish-integration.spec.ts \
  test/club-catalog-publish-service.spec.ts \
  test/platform-tenant-surfaces.spec.ts \
  test/public-tenant-context.spec.ts \
  test/read-tenant-site-surfaces.spec.ts \
  test/seed-tenant-site-surfaces.spec.ts \
  test/platform-club-product-exit.spec.ts

echo "== p4:gate — marketing unit =="
pnpm --filter @apps/marketing exec node --import tsx --test \
  test/revalidate-route.spec.ts \
  test/resolve-web-registration-url.spec.ts \
  test/tenant-site-surfaces-maintenance.spec.ts

echo "== p4:gate — portal unit =="
pnpm --filter @apps/portal test

echo "== p4:gate — web portal redirect + surfaces =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/portal-registration-redirect.spec.ts \
  test/catalog-register-redirect-page.spec.ts \
  test/platform-club-surfaces-tab.spec.ts \
  test/format-registration-intake.spec.ts

echo "P4_CLUB_PRODUCT_GATE_OK"
