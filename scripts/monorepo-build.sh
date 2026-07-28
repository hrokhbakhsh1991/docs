#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash scripts/with-monorepo-build-lock.sh bash -c '
  set -euo pipefail
  pnpm --dir packages/catalog-registration-auth run build
  pnpm --dir packages/workspace-sdk run build
  pnpm --filter @app-cloud/platform-core run build
  pnpm --filter @app-cloud/design-tokens run build
  pnpm --filter @app-cloud/ui-primitives run build
  pnpm --filter @app-cloud/theme-react run build
  pnpm --filter @app-cloud/workspace-starter run build
  pnpm --filter @app-cloud/workspace-denali run build
  pnpm --filter @app-cloud/workspace-urban run build
  pnpm --filter @app-cloud/workspace-guest-club run build
  pnpm --filter @app-cloud/tenant-kernel run build
  pnpm --filter @app-cloud/platform-events run build
  pnpm --filter @app-cloud/draft-engine run build
  pnpm --filter @app-cloud/wizard-navigation run build
  pnpm --filter @apps/api run build
  pnpm --filter @apps/marketing run build
  pnpm --filter @apps/portal run build
'
