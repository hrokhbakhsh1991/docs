#!/usr/bin/env bash
# CI integrity gate — full-repo eslint, depcruise, unit tests, and socket audit.
#
# Incremental checks on save: `pnpm run dev:integrity` (watches src/ via chokidar).
# Per-file subset: `bash scripts/ci-integrity-check-changed.sh <files...>`
#
# Usage (from repo root):
#   bash scripts/ci-integrity-check.sh
#   pnpm run ci:integrity
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# Flip Phase 4 Batch 4 Strict Architectural Boundary Enforce switch permanently
export ARCHITECTURE_BOUNDARIES_ENFORCE=1


step() {
  echo ""
  echo "==> $*"
  echo ""
}

step "pnpm eslint (zero warnings, full tree)"
pnpm run eslint

step "pnpm depcruise (architecture rules, full tree)"
pnpm run depcruise

step "pnpm test (draft-engine, shared, api unit tests)"
pnpm run test

step "React Query tenant cache isolation (query-key integrity)"
pnpm run guardrails:query-key-integrity

step "socket ci (supply-chain; skipped locally without SOCKET_SECURITY_API_TOKEN)"
pnpm run audit:socket

echo ""
echo "ci-integrity-check: all gates passed."
