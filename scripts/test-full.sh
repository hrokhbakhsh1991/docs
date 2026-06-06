#!/usr/bin/env bash
# Full verification path — phase-3 closure + phase-4 (RLS integration when DATABASE_URL is set).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "test-full: phase-3:gate + phase-4:gate + phase-5:gate"
echo "test-full: for RLS integration set DATABASE_URL + STORAGE_DRIVER=prisma (see docs/phase-4/ci.md)"

pnpm run phase-3:gate
pnpm run phase-4:gate
pnpm run phase-5:gate

echo "test-full: PASS"
