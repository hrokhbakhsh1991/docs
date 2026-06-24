#!/usr/bin/env bash
# P6 — dev closure orchestrator (gate + staging preflight + checklist)
# @see docs/phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p6:closure — product gate =="
pnpm run p6:gate

if [[ "${P6_FAST_CLOSE:-}" == "1" ]]; then
  echo "== p6:closure — skip staging preflight (P6_FAST_CLOSE=1 · deferred P7) =="
else
  echo "== p6:closure — staging preflight =="
  pnpm run p6:staging-preflight
fi

echo "== p6:closure — manual checklist (not automated here) =="
echo "  [ ] pnpm run p6:e2e-gate → P6_E2E_GATE_OK (local — TEMP/FOR YOU.md §A)"
echo "  [ ] VPS install/build/migrate → TEMP/FOR YOU.md §D"
echo "  [ ] p6:staging-preflight on VPS → TEMP/FOR YOU.md §E (P7)"
echo "  [ ] MinIO live receipt → P7"

echo "P6_CLOSURE_OK"
