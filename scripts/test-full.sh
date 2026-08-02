#!/usr/bin/env bash
# Full verification path — single entry to phase-5:gate (nests phase-4:gate → phase-3:gate).
# RLS integration when DATABASE_URL is set (see docs/phase-4/ci.md).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "test-full: phase-5:gate (includes phase-4:gate → phase-3:gate)"
echo "test-full: for RLS integration set DATABASE_URL + STORAGE_DRIVER=prisma (see docs/phase-4/ci.md)"

pnpm run phase-5:gate

echo "test-full: PASS"
