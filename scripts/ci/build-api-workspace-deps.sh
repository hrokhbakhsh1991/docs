#!/usr/bin/env bash
# Build workspace plugins + dist-backed deps for @apps/api prebuild.
# Uses `pnpm --dir` (not bare --filter) so CI never no-ops; ordered so denali
# does not tsc before booking/finance/platform-core dist exists.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pnpm --dir packages/catalog-registration-auth run build
pnpm --dir packages/workspace-sdk run build
pnpm --dir packages/platform-core run build
pnpm --dir packages/booking-http-contracts run build
pnpm --dir packages/finance-http-contracts run build
pnpm --dir packages/finance-http run build
pnpm --dir packages/finance-core run build
pnpm --dir packages/design-tokens run build
pnpm --dir packages/ui-primitives run build
pnpm --dir packages/theme-react run build
pnpm --dir packages/draft-engine run build
pnpm --dir packages/wizard-navigation run build
pnpm --dir packages/catalog-registration-flow-ui run build
pnpm --dir packages/catalog-intake-ui run build
pnpm --dir packages/tenant-kernel run build
pnpm --dir packages/workspaces/denali run build
pnpm --dir packages/workspaces/urban run build
pnpm --dir packages/workspaces/guest-club run build
pnpm --dir packages/workspaces/booking-ws2 run build
pnpm --dir packages/workspaces/finance-ws2 run build
pnpm --dir packages/workspaces/finance-ws3 run build
pnpm --dir packages/workspaces/finance-ws4 run build
pnpm --dir packages/workspaces/finance-ws5 run build
pnpm --dir packages/workspaces/finance-ws6 run build
