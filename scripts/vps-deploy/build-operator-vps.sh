#!/usr/bin/env bash
# VPS build — workspace deps + Next.js web. API runs via tsx until trunk tsc is green.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
cd "${DEPLOY_PATH}"

build_pkg() {
  pnpm --filter "$1" run build
}

build_pkg @app-tour/workspace-sdk
build_pkg @app-tour/platform-core
build_pkg @app-tour/design-tokens
build_pkg @app-tour/workspace-starter
build_pkg @app-tour/workspace-denali
build_pkg @app-tour/workspace-urban
build_pkg @app-tour/ui-primitives
build_pkg @app-tour/theme-react
build_pkg @app-tour/tenant-kernel
build_pkg @app-tour/platform-events
pnpm --filter @app-tour/wizard-navigation run build 2>/dev/null || true

build_pkg @apps/api

if [[ ! -f "${DEPLOY_PATH}/apps/api/dist/main.js" ]]; then
  echo "[vps-build] ERROR: apps/api/dist/main.js missing after @apps/api build" >&2
  exit 1
fi

cd "${DEPLOY_PATH}/apps/web"
NODE_ENV=production pnpm exec next build

echo "[vps-build] api + web production builds complete"
