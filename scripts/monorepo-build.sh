#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash scripts/with-monorepo-build-lock.sh bash -c '
  set -euo pipefail
  pnpm --filter @app-tour/workspace-sdk run build
  pnpm --filter @app-tour/platform-core run build
  pnpm --filter @app-tour/design-tokens run build
  pnpm --filter @app-tour/ui-primitives run build
  pnpm --filter @app-tour/theme-react run build
  pnpm --filter @app-tour/workspace-starter run build
  pnpm --filter @app-tour/workspace-denali run build
  pnpm --filter @app-tour/workspace-urban run build
  pnpm --filter @app-tour/workspace-guest-club run build
  pnpm --filter @app-tour/tenant-kernel run build
  pnpm --filter @app-tour/platform-events run build
  pnpm --filter @app-tour/draft-engine run build
  pnpm --filter @app-tour/wizard-navigation run build
  pnpm --filter @apps/api run build
  pnpm --filter @apps/marketing run build
  pnpm --filter @apps/portal run build
'
