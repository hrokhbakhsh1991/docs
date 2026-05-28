#!/usr/bin/env bash
# CI integrity gate — mirrors the core lint-staged checks (full repo, not staged-only).
#
# Pre-commit also runs: precommit-tsc-staged, test-pairing, jest/node:test on staged files.
# This script enforces the monorepo-wide eslint + depcruise + unit-test baseline on the server.
#
# Usage (from repo root):
#   bash scripts/ci-integrity-check.sh
#   pnpm run ci:integrity
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

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

step "socket ci (supply-chain; skipped locally without SOCKET_SECURITY_API_TOKEN)"
pnpm run audit:socket

echo ""
echo "ci-integrity-check: all gates passed."
