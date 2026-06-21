#!/usr/bin/env bash
# Stage P4 — Club Product Surfaces deliverables (apps + docs + gate + TEMP pack)
# Denali export slice: stage separately — see TEMP/p4-PR-PACK.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== stage-p4 — docs =="
git add docs/phase-17/
git add docs/phase-15/phase-15-closure.mdoc 2>/dev/null || true
git add docs/phase-11/subphases/11.16-user-portal.md 2>/dev/null || true

echo "== stage-p4 — gate scripts + root alias =="
git add scripts/p4-club-product-gate.sh scripts/p4-club-product-e2e-gate.sh
git add package.json

echo "== stage-p4 — TEMP agent pack =="
git add TEMP/p4/ TEMP/p4-club-product-surfaces.md TEMP/p4-exit-checklist.md TEMP/ROADMAP-INDEX.md 2>/dev/null || true

echo "== stage-p4 — API =="
git add apps/api/src/marketing/
git add apps/api/src/canonical/canonical-tour.service.ts
git add apps/api/src/platform/read-tenant-site-surfaces.ts
git add apps/api/src/platform/platform-tenant-detail.dto.ts
git add apps/api/src/platform/platform-tenant.repository.ts
git add apps/api/src/routes/platform/tenants-get.ts
git add apps/api/src/platform/check-tenant-sites-health.ts 2>/dev/null || true
git add apps/api/src/tenant/tenant-branding.service.ts 2>/dev/null || true
git add apps/api/test/club-catalog-publish-integration.spec.ts
git add apps/api/test/club-catalog-publish-service.spec.ts
git add apps/api/test/club-catalog-publish-test-helpers.ts
git add apps/api/test/platform-club-product-exit.spec.ts
git add apps/api/test/platform-tenant-surfaces.spec.ts
git add apps/api/test/public-tenant-context.spec.ts
git add apps/api/test/marketing-catalog-revalidate.spec.ts 2>/dev/null || true
git add apps/api/test/seed-tenant-site-surfaces.spec.ts 2>/dev/null || true
git add apps/api/test/platform-tenant-detail.spec.ts 2>/dev/null || true

echo "== stage-p4 — marketing =="
git add apps/marketing/app/api/revalidate/ 2>/dev/null || true
git add apps/marketing/app/layout.tsx
git add apps/marketing/src/tenant/marketing-site-surfaces.ts
git add apps/marketing/src/tenant/resolve-marketing-site-surfaces.ts
git add apps/marketing/src/tenant/fetch-public-tenant-context.ts 2>/dev/null || true
git add apps/marketing/test/revalidate-route.spec.ts
git add apps/marketing/test/tenant-site-surfaces-maintenance.spec.ts
git add apps/marketing/test/resolve-web-registration-url.spec.ts

echo "== stage-p4 — portal =="
git add apps/portal/app/api/catalog/registrations/route.ts 2>/dev/null || true
git add apps/portal/test/portal-catalog-registrations-bff.spec.ts 2>/dev/null || true
git add apps/portal/test/portal-catalog-registrations-dispatch.spec.ts 2>/dev/null || true
git add apps/portal/test/portal-public-auth-bff.spec.ts 2>/dev/null || true
git add apps/portal/test/resolve-portal-base-url.spec.ts 2>/dev/null || true

echo "== stage-p4 — web =="
git add apps/web/src/platform/club-detail/
git add apps/web/test/platform-club-surfaces-tab.spec.ts
git add apps/web/test/portal-registration-redirect.spec.ts
git add apps/web/test/catalog-register-redirect-page.spec.ts 2>/dev/null || true
git add apps/web/app/\(public\)/catalog/ 2>/dev/null || true

echo "== stage-p4 — denali export slice (minimal) =="
git add packages/workspaces/denali/package.json
git add packages/workspaces/denali/src/finance/api-tour-created-adapter.ts

echo "STAGE_P4_OK — review: git diff --cached --stat"
