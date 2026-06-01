#!/usr/bin/env bash
# Build workspace packages required for apps/api Nest E2E (api.e2e-spec.ts).
# Mirrors AGENTS.md pre-build chain; safe on fresh CI checkout (dist/ is gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

step() {
  echo ""
  echo "==> $*"
  echo ""
}

step "pnpm --filter @repo/types run build"
pnpm --filter @repo/types run build

step "pnpm --filter @repo/config run build"
pnpm --filter @repo/config run build

step "pnpm --filter @repo/domain-contracts run build"
pnpm --filter @repo/domain-contracts run build

step "pnpm --filter @repo/shared run build"
pnpm --filter @repo/shared run build

step "pnpm --filter @repo/shared-contracts exec tsc (Node16)"
pnpm --filter @repo/shared-contracts exec tsc -p tsconfig.json --module Node16 --moduleResolution node16

step "pnpm --filter @repo/draft-engine run build"
pnpm --filter @repo/draft-engine run build

step "pnpm --filter @repo/denali-domain run build"
pnpm --filter @repo/denali-domain run build

step "pnpm --filter @repo/tenant-host run build"
pnpm --filter @repo/tenant-host run build

step "pnpm --filter @repo/security/egress-url run build"
pnpm --filter @repo/security/egress-url run build

step "pnpm --filter @repo/testing-infra run build"
pnpm --filter @repo/testing-infra run build

step "pnpm --filter @repo/workspace-sdk run build"
pnpm --filter @repo/workspace-sdk run build

echo ""
echo "ci-backend-e2e-build: all packages built."
