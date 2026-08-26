#!/usr/bin/env bash
# Self-contained Prisma CLI bundle for VPS migrate deploy (no build-host symlinks).
set -euo pipefail

DEST="$1"
PRISMA_VERSION="${PRISMA_VERSION:-6.19.3}"

[[ -n "$DEST" ]] || {
  echo "bundle-prisma-migrate-for-artifact: usage <destDir>" >&2
  exit 1
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cat >"${WORK}/package.json" <<EOF
{
  "name": "staging-prisma-migrate",
  "private": true,
  "dependencies": {
    "prisma": "${PRISMA_VERSION}"
  }
}
EOF

(
  cd "$WORK"
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  NODE_ENV=development pnpm install --ignore-scripts
)

rm -rf "$DEST"
mkdir -p "$DEST"
/bin/cp -a "${WORK}/node_modules" "${DEST}/"
/bin/cp -a "${WORK}/package.json" "${DEST}/"

[[ -f "${DEST}/node_modules/prisma/build/index.js" ]] || {
  echo "bundle-prisma-migrate-for-artifact: prisma CLI missing" >&2
  exit 1
}

node "${DEST}/node_modules/prisma/build/index.js" version >/dev/null
echo "bundle-prisma-migrate-for-artifact: OK"
