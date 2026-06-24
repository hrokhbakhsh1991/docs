#!/usr/bin/env bash
# P4 — Club Product Surfaces Playwright smokes (optional · Architect YES for CI)
# @see docs/phase-17/platform-club-product-e2e.mdoc
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p4:e2e-gate — marketing catalog smokes (SMK-MKT) =="
pnpm --filter @apps/marketing exec playwright test -c playwright.marketing.config.ts

echo "== p4:e2e-gate — portal registration smoke (SMK-PTL-01 / SMK-DREG-01) =="
pnpm --filter @apps/portal exec playwright test -c playwright.portal.config.ts

echo "P4_CLUB_PRODUCT_E2E_GATE_OK"
