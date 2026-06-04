#!/usr/bin/env bash
# CI / explicit full-path integrity — phase chain 0 → 1 → 2 → 3 (not Husky pre-commit).
# Husky default: scripts/pre-commit-fast.sh. PR / Phase 4: pnpm run test:full.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "ci-integrity: Node engine (.nvmrc / engines)"
node scripts/guards/check-node-engine.mjs

echo "ci-integrity: phase-0:gate (foundation test:phase-0 + integration build/test/guards/baseline:metrics)"
pnpm run phase-0:gate

echo "ci-integrity: phase-1:gate (platform-core closure + phase-1-guard)"
pnpm run phase-1:gate

echo "ci-integrity: phase-2:gate (visual-layer invariants + p2_* guards)"
pnpm run phase-2:gate

echo "ci-integrity: phase-3:gate (apps + starter + doc-gate + p3_* guards)"
pnpm run phase-3:gate

echo "ci-integrity: PASS (phases 0–3)"
