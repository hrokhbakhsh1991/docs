#!/usr/bin/env bash
# Phase I fast-track — theme import budget + related guards (target <2 min).
# @see docs/dev/workspace-scale-hardening.mdoc
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Phase I fast-track =="

pnpm run guard:theme-import-budget
node --test scripts/test/theme-import-budget-guard.spec.mjs
pnpm run guard:workspace-plugin-load-cache
node --test scripts/test/workspace-plugin-load-cache-guard.spec.mjs
pnpm --filter @apps/web exec node --import tsx --test test/workspace-plugin-load-cache.spec.ts
pnpm run phase-10:guard

echo "phase-i:fast-track: PASS"
