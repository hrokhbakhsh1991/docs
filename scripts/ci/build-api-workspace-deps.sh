#!/usr/bin/env bash
# Build workspace plugins + dist-backed deps for @apps/api prebuild / booking gates.
# Uses `pnpm --dir` (not bare --filter) so CI never no-ops; ordered so consumers
# do not tsc/import before dependency dist exists.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pnpm --dir packages/catalog-registration-auth run build
pnpm --dir packages/workspace-sdk run build
pnpm --dir packages/platform-core run build
pnpm --dir packages/booking-http-contracts run build
pnpm --dir packages/finance-http-contracts run build
pnpm --dir packages/finance-core run build
pnpm --dir packages/finance-http run build
pnpm --dir packages/design-tokens run build
pnpm --dir packages/ui-primitives run build
pnpm --dir packages/theme-react run build
pnpm --dir packages/draft-engine run build
pnpm --dir packages/wizard-navigation run build
pnpm --dir packages/catalog-registration-flow-ui run build
pnpm --dir packages/catalog-intake-ui run build
pnpm --dir packages/tenant-kernel run build
pnpm --dir packages/platform-events run build

# All product workspaces with a build script (registry + generated bindings).
for dir in packages/workspaces/*/ ; do
  if [[ -f "${dir}package.json" ]] && grep -q '"build"' "${dir}package.json"; then
    pnpm --dir "$dir" run build
  fi
done
