#!/usr/bin/env bash
# P1 Platform Control Center fast gate — unit specs + structural smokes (<~2min, no Playwright E2E)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== P1 structural smokes =="
node apps/api/scripts/smoke-platform-provision.mjs --help >/dev/null
node apps/web/scripts/smoke-platform-ui.mjs

echo "== P1 API specs =="
pnpm --filter @apps/api exec node --import tsx --test --test-force-exit \
  test/platform-provision.spec.ts \
  test/platform-tenants-get.spec.ts \
  test/platform-tenant-status.spec.ts \
  test/platform-tenant-suspend-login.spec.ts \
  test/platform-registry-cache.spec.ts \
  test/platform-audit-actor.spec.ts \
  test/platform-sites-check-timeout.spec.ts \
  test/platform-ops-auth.spec.ts \
  test/platform-auth-session.spec.ts \
  test/platform-auth-db-role.spec.ts \
  test/platform-tenant-suspend-revoke.spec.ts \
  test/platform-rbac.spec.ts \
  test/platform-team.spec.ts \
  test/platform-epic-b.spec.ts

echo "== P1 web specs =="
cd apps/web
NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/platform-nav.spec.ts \
  test/platform-team-page.spec.ts \
  test/platform-host-isolation.spec.ts \
  test/session-host-binding-multilevel.spec.ts \
  test/platform-epic-c-boundary.spec.ts \
  test/platform-epic-d-boundary.spec.ts \
  test/platform-middleware-imports.spec.ts \
  test/platform-session-jwt.spec.ts \
  test/platform-session-cookie.spec.ts \
  test/load-platform-overview-unhealthy.spec.ts \
  test/load-platform-overview-stats.spec.ts \
  test/platform-audit-page.spec.ts \
  test/platform-club-detail-page.spec.ts \
  test/platform-overview-page.spec.ts

echo "P1_PLATFORM_GATE_OK"
