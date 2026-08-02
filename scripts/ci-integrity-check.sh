#!/usr/bin/env bash
# CI / explicit full-path integrity — phase chain 0 → 3 + phase-4 guard + evolution (DEC-119).
# Husky default: scripts/pre-commit-fast.sh. Full perf: pnpm run test:full (phase-5:gate).
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

echo "ci-integrity: phase-3:gate (static phase-3:guard + phase-3:apps-cert)"
pnpm run phase-3:gate

echo "ci-integrity: phase-4:guard (tenant-kernel + RLS when DATABASE_URL set)"
pnpm run phase-4:guard

echo "ci-integrity: apps/api phase-5:evolution-gate (DEC-109…118 static guards)"
pnpm --filter @apps/api run phase-5:evolution-gate

echo "ci-integrity: PASS (phases 0–3 + phase-4 guard + evolution)"
