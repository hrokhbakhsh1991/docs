#!/usr/bin/env bash
# Build workspace-sdk dependency chain for guards (validate-json-ld / guest_seo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f packages/workspace-sdk/dist/index.js ]]; then
  echo "build-workspace-sdk-for-guards: dist present — skip"
  exit 0
fi

echo "build-workspace-sdk-for-guards: catalog-registration-auth → workspace-sdk"
pnpm --dir packages/catalog-registration-auth run build
pnpm --dir packages/workspace-sdk run build
echo "build-workspace-sdk-for-guards: PASS"
