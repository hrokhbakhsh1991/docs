#!/usr/bin/env bash
# Phase G+H closure fast-track — run before DEV→main PR (target <5 min).
# @see docs/dev/workspace-certification.mdoc § Phase H closure verification
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Phase G+H fast-track =="

bash scripts/ci/build-workspace-sdk-for-guards.sh

pnpm run guard:workspace-registry-fresh
pnpm run phase-10:guard
pnpm run guard:guest-plugin-conformance

node --test scripts/test/workspace-registry-drop-in.spec.mjs
node --test scripts/test/workspace-production-certification.spec.mjs
node --test scripts/test/workspace-certification-guard.spec.mjs
pnpm run guard:workspace-certification

pnpm --filter @apps/api exec node --import tsx --test test/provision-tenant-production.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/list-platform-workspaces.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/workspace-not-certified-error-interceptor.spec.ts
pnpm --filter @apps/api run guard:openapi-dispatch-parity

pnpm --filter @apps/web exec node --import tsx --test test/workspace-production-certification-badge.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/use-create-club-wizard.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/submit-create-club-certification.spec.ts
node apps/web/scripts/smoke-platform-create-club.mjs

echo "phase-g-h:fast-track: PASS"
