#!/usr/bin/env bash
# Wave I.0 — architecture guard matrix (static; no full monorepo build/test).
# @see docs/dev/wave-i-0-architecture-guard-matrix.mdoc
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== wave-i0:guard =="

pnpm run guard:no-app-cloud-imports
pnpm run guard:import-boundary
pnpm run guard:workspace-peer-import
pnpm run guard:workspace-registry-fresh
pnpm run guard:api-workspace-isolation
pnpm run guard:api-host-allowlist-ratchet
pnpm run guard:guest-runtime-product-deps
pnpm run guard:plugin-host-neutrality
pnpm run guard:transpile-product-ceiling
pnpm run guard:deploy-profile-plan
pnpm run guard:bundle-profile-isolation
pnpm run test:gap-closure-acceptance
pnpm run guard:host-workspace-deps
pnpm run guard:thin-shell
pnpm run guard:shell-product-tokens

echo "wave-i0:guard: PASS"
