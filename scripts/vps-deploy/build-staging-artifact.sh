#!/usr/bin/env bash
# Build a versioned staging release artifact OFF the VPS (CI / build host).
# Produces: dist/app-tour-staging-<SHA>.tar.zst + .sha256 + release-manifest.json
#
# Usage:
#   bash scripts/vps-deploy/build-staging-artifact.sh
#   OUT_DIR=/tmp/artifacts bash scripts/vps-deploy/build-staging-artifact.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/artifact-standalone-next.sh
source "${SCRIPT_DIR}/lib/artifact-standalone-next.sh"

OUT_DIR="${OUT_DIR:-${REPO_ROOT}/dist/staging-artifacts}"
WORK_DIR="${WORK_DIR:-${REPO_ROOT}/.artifact-build}"
SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
MIGRATION_HEAD="$(ls -1 "${REPO_ROOT}/apps/api/prisma/migrations" | grep -E '^[0-9]' | sort | tail -1)"
ARTIFACT_NAME="app-tour-staging-${SHA}"
ARTIFACT_ROOT="${WORK_DIR}/${ARTIFACT_NAME}"
TARBALL="${OUT_DIR}/${ARTIFACT_NAME}.tar.zst"

log() { printf '[build-artifact] %s\n' "$*"; }

[[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || {
  echo "build-staging-artifact: dirty working tree — commit or stash first" >&2
  exit 1
}

log "RELEASE_SHA=$SHA migration_head=$MIGRATION_HEAD"
rm -rf "$ARTIFACT_ROOT"
mkdir -p "$ARTIFACT_ROOT" "$OUT_DIR"

log "pnpm install --frozen-lockfile"
cd "$REPO_ROOT"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm install --frozen-lockfile

log "prisma generate"
pnpm --filter @apps/api run prisma:generate

log "migration head preflight"
pnpm --filter @apps/api run guard:migration-head-preflight

log "production build (standalone Next + API dist)"
export ARTIFACT_STANDALONE_BUILD=1
export STAGING_WEB_BUILD=1
export NODE_ENV=production
export CI=true
export NEXT_FONT_OFFLINE=1
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

for pair in web:apps/web portal:apps/portal marketing:apps/marketing; do
  key="${pair%%:*}"
  rel="${pair#*:}"
  package_next_standalone "$REPO_ROOT" "$rel" "${ARTIFACT_ROOT}/${key}"
done

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
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
MIG
chmod +x "${ARTIFACT_ROOT}/bin/migrate-deploy.sh"

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

log "tar.zst ${TARBALL}"
tar -C "${WORK_DIR}" -cf - "${ARTIFACT_NAME}" | zstd -19 -T0 -o "${TARBALL}"
sha256sum "${TARBALL}" | tee "${TARBALL}.sha256"

log "self-check extract"
VERIFY_DIR="${WORK_DIR}/verify-${SHA}"
rm -rf "$VERIFY_DIR"
mkdir -p "$VERIFY_DIR"
tar -I zstd -xf "${TARBALL}" -C "$VERIFY_DIR"
VROOT="${VERIFY_DIR}/${ARTIFACT_NAME}"
[[ -f "${VROOT}/api/dist/main.js" ]] || exit 1
for k in web portal marketing; do
  [[ -f "${VROOT}/${k}/RUNTIME.json" ]] || exit 1
done
[[ -f "${VROOT}/bin/migrate-deploy.sh" ]] || exit 1

log "ARTIFACT_OK ${TARBALL}"
log "SHA256 $(cut -d' ' -f1 "${TARBALL}.sha256")"
