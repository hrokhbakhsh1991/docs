#!/usr/bin/env bash
# CI integrity — frontend / platform SDK guardrails only (main push).
# Full-repo gate: scripts/ci-integrity-check.sh (PR / pre-commit).
#
# Usage:
#   bash scripts/ci-integrity-frontend.sh
#   pnpm run ci:integrity:frontend
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

export ARCHITECTURE_BOUNDARIES_ENFORCE=1

step() {
  echo ""
  echo "==> $*"
  echo ""
}

step "phase 1 workspace-sdk guard (denali-free contract, build, test, depcruise)"
pnpm run phase-1:guard

step "React Query tenant cache isolation (query-key integrity)"
pnpm run guardrails:query-key-integrity

echo ""
echo "ci-integrity-frontend: all gates passed."
