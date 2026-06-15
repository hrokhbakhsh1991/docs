#!/usr/bin/env bash
# VPS build — workspace deps + Next.js web. API runs via tsx until trunk tsc is green.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
WEB_DIR="${DEPLOY_PATH}/apps/web"
cd "${DEPLOY_PATH}"

build_pkg() {
  pnpm --filter "$1" run build
}

clean_web_next_artifacts() {
  rm -rf \
    "${WEB_DIR}/.next" \
    "${WEB_DIR}/out" \
    "${WEB_DIR}/node_modules/.cache"
  find "${WEB_DIR}" -maxdepth 1 -name '.next.*' -exec rm -rf {} + 2>/dev/null || true
}

build_web_production() {
  local attempt
  for attempt in 1 2; do
    clean_web_next_artifacts
    if (
      cd "${WEB_DIR}"
      export NODE_ENV=production
      export CI=true
      export NEXT_FONT_OFFLINE=1
      /usr/local/bin/pnpm exec next build
    ); then
      return 0
    fi
    if [[ "$attempt" -eq 2 ]]; then
      echo "[vps-build] ERROR: @apps/web next build failed after 2 attempts" >&2
      return 1
    fi
    echo "[vps-build] WARN: next build attempt ${attempt} failed — retrying after clean" >&2
    sleep 2
  done
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

build_web_production

echo "[vps-build] api + web production builds complete"
