#!/usr/bin/env bash
# VPS build — workspace deps + Next.js web. API runs via tsx until trunk tsc is green.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
WEB_DIR="${DEPLOY_PATH}/apps/web"
PNPM_BIN="${PNPM_BIN:-/usr/local/bin/pnpm}"
if [[ ! -x "$PNPM_BIN" ]]; then
  PNPM_BIN="$(command -v pnpm)"
fi
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
      cd "${DEPLOY_PATH}"
      if [[ "${WORKSPACE_DEPLOY_PROFILE_APPLY:-}" == "1" ]]; then
        ${PNPM_BIN} run apply:deploy-profile -- --write
      fi
      cd "${WEB_DIR}"
      export NODE_ENV=production
      export CI=true
      export NEXT_FONT_OFFLINE=1
      ${PNPM_BIN} exec next build
      status=$?
      if [[ "${WORKSPACE_DEPLOY_PROFILE_APPLY:-}" == "1" ]]; then
        cd "${DEPLOY_PATH}"
        ${PNPM_BIN} run generate:workspace-registry
      fi
      exit $status
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
build_pkg @app-tour/ui-primitives
build_pkg @app-tour/theme-react
build_pkg @app-tour/tenant-kernel
build_pkg @app-tour/guest-surface-host
build_pkg @app-tour/session-client
build_pkg @app-tour/platform-events
pnpm --filter @app-tour/wizard-navigation run build 2>/dev/null || true
pnpm --filter @app-tour/draft-engine run build 2>/dev/null || true
build_pkg @app-tour/workspace-denali
build_pkg @app-tour/workspace-urban

build_pkg @apps/api

if [[ ! -f "${DEPLOY_PATH}/apps/api/dist/main.js" ]]; then
  echo "[vps-build] ERROR: apps/api/dist/main.js missing after @apps/api build" >&2
  exit 1
fi

build_web_production

build_next_app() {
  local app_dir="$1"
  local label="$2"
  rm -rf "${app_dir}/.next" "${app_dir}/out" "${app_dir}/node_modules/.cache"
  (
    cd "$app_dir"
    export NODE_ENV=production
    export CI=true
    export NEXT_FONT_OFFLINE=1
    ${PNPM_BIN} exec next build
  ) || {
    echo "[vps-build] ERROR: ${label} next build failed" >&2
    return 1
  }
}

build_next_app "${DEPLOY_PATH}/apps/marketing" "@apps/marketing"
build_next_app "${DEPLOY_PATH}/apps/portal" "@apps/portal"

echo "[vps-build] api + web + marketing + portal production builds complete"
