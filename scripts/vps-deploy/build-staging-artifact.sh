#!/usr/bin/env bash
# Build a versioned staging release artifact OFF the VPS (CI / build host).
# Produces: dist/staging-artifacts/app-tour-staging-<SHA>.tar.zst + .sha256 + release-manifest.json
#
# Usage:
#   bash scripts/vps-deploy/build-staging-artifact.sh
#   OUT_DIR=/tmp/artifacts bash scripts/vps-deploy/build-staging-artifact.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/artifact-standalone-next.sh
source "${SCRIPT_DIR}/lib/artifact-standalone-next.sh"
# shellcheck source=lib/artifact-self-check.sh
source "${SCRIPT_DIR}/lib/artifact-self-check.sh"
# shellcheck source=lib/artifact-clean-room-check.sh
source "${SCRIPT_DIR}/lib/artifact-clean-room-check.sh"

OUT_DIR="${OUT_DIR:-${REPO_ROOT}/dist/staging-artifacts}"
WORK_DIR="${WORK_DIR:-${REPO_ROOT}/.artifact-build}"
SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
MIGRATION_HEAD="$(ls -1 "${REPO_ROOT}/apps/api/prisma/migrations" | grep -E '^[0-9]' | sort | tail -1)"
ARTIFACT_NAME="app-tour-staging-${SHA}"
ARTIFACT_ROOT="${WORK_DIR}/${ARTIFACT_NAME}"
TARBALL="${OUT_DIR}/${ARTIFACT_NAME}.tar.zst"
TARBALL_BASE="$(basename "$TARBALL")"

log() { printf '[build-artifact] %s\n' "$*"; }

[[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || {
  echo "build-staging-artifact: dirty working tree — commit or stash first" >&2
  exit 1
}

log "RELEASE_SHA=$SHA migration_head=$MIGRATION_HEAD"
rm -rf "$ARTIFACT_ROOT"
mkdir -p "$ARTIFACT_ROOT" "$OUT_DIR"

log "pnpm install --frozen-lockfile (build host; skip lifecycle scripts)"
cd "$REPO_ROOT"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
NODE_ENV=development pnpm install --frozen-lockfile --ignore-scripts

log "prisma generate (build host)"
pnpm --filter @apps/api run prisma:generate

log "migration head preflight"
pnpm --filter @apps/api run guard:migration-head-preflight

log "workspace dependency graph (CI order)"
bash "${REPO_ROOT}/scripts/ci/build-api-workspace-deps.sh"

log "production build (standalone Next + API dist; Denali staging profile)"
export DEPLOY_PATH="$REPO_ROOT"
export ARTIFACT_STANDALONE_BUILD=1
export STAGING_WEB_BUILD=1
export PREBUILT_WORKSPACE_DEPS=1
export NODE_ENV=production
export CI=true
export NEXT_FONT_OFFLINE=1
export MARKETING_IMAGE_REMOTE_HOSTS="${MARKETING_IMAGE_REMOTE_HOSTS:-89.42.210.252:9002}"
# shellcheck disable=SC1090
eval "$(node "${REPO_ROOT}/scripts/vps-deploy/resolve-staging-web-plugin-allow-env.mjs")"
[[ "${ALLOW_DENALI_WEB_PLUGIN:-}" == "true" ]] || {
  echo "build-staging-artifact: ALLOW_DENALI_WEB_PLUGIN must be true for Denali staging artifact" >&2
  exit 1
}
bash "${REPO_ROOT}/scripts/vps-deploy/build-operator-vps.sh"

log "package API runtime (pnpm deploy --prod)"
API_DEPLOY="${WORK_DIR}/api-deploy"
rm -rf "$API_DEPLOY"
pnpm --filter @apps/api deploy "$API_DEPLOY" --prod
mkdir -p "${ARTIFACT_ROOT}/api"
cp -a "${API_DEPLOY}/." "${ARTIFACT_ROOT}/api/"
cp -a "${REPO_ROOT}/apps/api/prisma" "${ARTIFACT_ROOT}/api/prisma"
[[ -f "${ARTIFACT_ROOT}/api/dist/main.js" ]] || {
  echo "build-staging-artifact: api dist/main.js missing after deploy" >&2
  exit 1
}

log "bundle prisma CLI + generated client for migrate/runtime"
node "${SCRIPT_DIR}/lib/bundle-api-prisma-for-artifact.mjs" "${ARTIFACT_ROOT}/api" "${REPO_ROOT}"
bash "${SCRIPT_DIR}/lib/bundle-prisma-migrate-for-artifact.sh" "${ARTIFACT_ROOT}/prisma-migrate"

for pair in web:apps/web portal:apps/portal marketing:apps/marketing; do
  key="${pair%%:*}"
  rel="${pair#*:}"
  package_next_standalone "$REPO_ROOT" "$rel" "${ARTIFACT_ROOT}/${key}"
done

log "bundle staging seed (synthetic operator/Denali)"
pnpm --filter @apps/api exec esbuild "${REPO_ROOT}/apps/api/scripts/seed-operator-staging.ts" \
  --bundle \
  --platform=node \
  --format=cjs \
  --packages=external \
  --outfile="${ARTIFACT_ROOT}/bin/seed-staging.cjs"

log "bundle Denali Wallet pilot seed (explicit staging opt-in)"
pnpm --filter @apps/api exec esbuild "${REPO_ROOT}/apps/api/scripts/seed-denali-wallet-pilot.ts" \
  --bundle \
  --platform=node \
  --format=cjs \
  --packages=external \
  --outfile="${ARTIFACT_ROOT}/bin/seed-denali-wallet-pilot.cjs"
cp -a "${SCRIPT_DIR}/seed-denali-wallet-pilot-artifact.sh" "${ARTIFACT_ROOT}/bin/seed-denali-wallet-pilot.sh"
chmod +x "${ARTIFACT_ROOT}/bin/seed-denali-wallet-pilot.sh"

log "bundle migrate helper"
mkdir -p "${ARTIFACT_ROOT}/bin"
cat >"${ARTIFACT_ROOT}/bin/migrate-deploy.sh" <<'MIG'
#!/usr/bin/env bash
set -euo pipefail
RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-/etc/app-tour-staging/api.env}"
set -a; source "$ENV_FILE"; set +a
cd "${RELEASE_ROOT}/api"
export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
node "${RELEASE_ROOT}/prisma-migrate/node_modules/prisma/build/index.js" migrate deploy --schema=./prisma/schema.prisma
MIG
chmod +x "${ARTIFACT_ROOT}/bin/migrate-deploy.sh"
cp -a "${SCRIPT_DIR}/seed-staging-artifact.sh" "${ARTIFACT_ROOT}/bin/seed-staging.sh"
chmod +x "${ARTIFACT_ROOT}/bin/seed-staging.sh"

NODE_V="$(node -v)"
PNPM_V="$(pnpm -v)"
BUILD_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >"${ARTIFACT_ROOT}/release-manifest.json" <<EOF
{
  "releaseSha": "${SHA}",
  "buildTimestamp": "${BUILD_TS}",
  "nodeVersion": "${NODE_V}",
  "pnpmVersion": "${PNPM_V}",
  "migrationHead": "${MIGRATION_HEAD}",
  "denaliClientBundle": true,
  "denaliWalletPilotSeedBundle": true,
  "layout": {
    "api": "api/dist/main.js",
    "web": "web/RUNTIME.json",
    "portal": "portal/RUNTIME.json",
    "marketing": "marketing/RUNTIME.json"
  },
  "ports": {
    "web": 23000,
    "api": 23001,
    "marketing": 23002,
    "portal": 23003
  }
}
EOF

log "artifact layout self-check (pre-tar)"
artifact_self_check "$ARTIFACT_ROOT" "$SHA"

log "tar.zst ${TARBALL}"
tar -C "${WORK_DIR}" -cf - "${ARTIFACT_NAME}" | zstd -19 -T0 -f -o "${TARBALL}"
(
  cd "$OUT_DIR"
  sha256sum "$TARBALL_BASE" | tee "${TARBALL_BASE}.sha256"
)
ARTIFACT_DIGEST_SHA256="$(cut -d' ' -f1 "${TARBALL}.sha256")"
cat >"${TARBALL}.manifest.json" <<EOF
{
  "releaseSha": "${SHA}",
  "artifactDigestSha256": "${ARTIFACT_DIGEST_SHA256}"
}
EOF

log "self-check extract"
VERIFY_DIR="${WORK_DIR}/verify-${SHA}"
rm -rf "$VERIFY_DIR"
mkdir -p "$VERIFY_DIR"
tar -I zstd -xf "${TARBALL}" -C "$VERIFY_DIR"
VROOT="${VERIFY_DIR}/${ARTIFACT_NAME}"
artifact_self_check "$VROOT" "$SHA"
artifact_clean_room_check "$VROOT" "$REPO_ROOT"

log "ARTIFACT_OK ${TARBALL}"
log "SHA256 ${ARTIFACT_DIGEST_SHA256}"
