#!/usr/bin/env bash
# Local integrity gate — mirrors phase-0:gate + Phase 1 guard delta (symlink, phase-1-guard).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "ci-integrity: Node engine (.nvmrc / engines)"
node scripts/guards/check-node-engine.mjs

echo "ci-integrity: phase-0:gate (foundation test:phase-0 + integration build/test/guards/baseline:metrics)"
pnpm run phase-0:gate

echo "ci-integrity: Phase 1 delta (symlink + phase-1-guard)"
pnpm run guard:symlink
node scripts/guards/phase-1-guard.mjs

echo "ci-integrity: PASS"
