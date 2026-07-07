#!/usr/bin/env bash
# Phase I closure fast-track — G+H regression + I1/I2 guards (target <8 min).
# @see docs/dev/workspace-scale-hardening.mdoc § Phase I closure
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Phase I closure fast-track =="

pnpm run phase-g-h:fast-track

pnpm run guard:theme-import-budget
pnpm run guard:workspace-plugin-load-cache

node --test scripts/test/theme-import-budget-guard.spec.mjs
node --test scripts/test/workspace-plugin-load-cache-guard.spec.mjs
pnpm --filter @apps/web exec node --import tsx --test test/workspace-plugin-load-cache.spec.ts

echo "phase-i:closure: PASS"
