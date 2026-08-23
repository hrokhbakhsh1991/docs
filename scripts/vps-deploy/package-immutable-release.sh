#!/usr/bin/env bash
# PROD-8 — package full immutable release tree (CI / clean checkout only).
# Includes built artifacts + node_modules — no install/build required on VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHA="${1:-$(cd "$ROOT" && git rev-parse HEAD)}"
OUT_DIR="${OUT_DIR:-$ROOT/.artifacts/prod8}"
STAGING="${OUT_DIR}/staging-${SHA}"
TARBALL="${OUT_DIR}/prod8-release-${SHA}.tar.gz"

cd "$ROOT"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "[package-immutable] ERROR: clean worktree required" >&2
  exit 1
fi

node scripts/ops/prod8-artifact-preflight.mjs

rm -rf "$STAGING"
mkdir -p "$STAGING"
git archive "$SHA" | tar -x -C "$STAGING"
(
  cd "$STAGING"
  export DEPLOY_PATH="$STAGING"
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  /usr/local/bin/pnpm install --frozen-lockfile
  DEPLOY_PATH="$STAGING" bash scripts/vps-deploy/build-operator-vps.sh
)

node scripts/ops/prod8-build-immutable-bundle.mjs --artifact-root "$STAGING" --git-sha "$SHA"

mkdir -p "$OUT_DIR"
tar -czf "$TARBALL" -C "$STAGING" .
sha256sum "$TARBALL" > "${TARBALL}.sha256"
echo "[package-immutable] OK $TARBALL ($(du -h "$TARBALL" | awk '{print $1}'))"
cat "${TARBALL}.sha256"
