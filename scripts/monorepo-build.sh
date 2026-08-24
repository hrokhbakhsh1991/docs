#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Prefer `pnpm --dir` over bare `--filter @scope/name` (filter can no-op with exit 0).
# Dist-backed packages must precede consumers (denali needs contracts + finance-http + platform-core).
bash scripts/with-monorepo-build-lock.sh bash -c '
  set -euo pipefail
  # Root build establishes every API workspace dependency above; prevent the
  # API package prebuild from rebuilding the same graph before tsc.
  export APP_TOUR_SKIP_API_WORKSPACE_DEPS=1
  pnpm --dir packages/catalog-registration-auth run build
  pnpm --dir packages/tour-core run build
  pnpm --dir packages/workspace-sdk run build
  pnpm --dir packages/workspace-plugin-host run build
  pnpm --dir packages/platform-core run build
  pnpm --dir packages/booking-http-contracts run build
  pnpm --dir packages/finance-http-contracts run build
  pnpm --dir packages/finance-http run build
  pnpm --dir packages/design-tokens run build
  pnpm --dir packages/ui-primitives run build
  pnpm --dir packages/theme-react run build
  pnpm --dir packages/draft-engine run build
  pnpm --dir packages/wizard-navigation run build
  pnpm --dir packages/catalog-registration-flow-ui run build
  pnpm --dir packages/catalog-intake-ui run build
  pnpm --dir packages/workspaces/starter run build
  pnpm --dir packages/tenant-kernel run build
  pnpm --dir packages/workspaces/denali run build
  pnpm --dir packages/workspaces/urban run build
  pnpm --dir packages/workspaces/guest-club run build
  pnpm --dir packages/workspaces/acme run build
  pnpm --dir packages/workspaces/harbor run build
  pnpm --dir packages/platform-events run build
  pnpm --dir packages/finance-core run build
  pnpm --dir packages/workspaces/booking-ws2 run build
  pnpm --dir packages/workspaces/finance-ws2 run build
  pnpm --dir packages/workspaces/finance-ws3 run build
  pnpm --dir packages/workspaces/finance-ws4 run build
  pnpm --dir packages/workspaces/finance-ws5 run build
  pnpm --dir packages/workspaces/finance-ws6 run build
  pnpm --dir packages/session-client run build
  pnpm --dir packages/guest-surface-host run build
  pnpm --dir packages/guest-workspace-runtime run build
  # Dist-backed; consumed by apps/web geocoding (unit tests after root build).
  pnpm --dir packages/iran-mountain-landmarks run build
  pnpm --dir apps/api run build
  pnpm --dir apps/marketing run build
  pnpm --dir apps/portal run build
'
