#!/usr/bin/env bash
# P7 T4 — reset VPS smoke rows + verify infra before customer session
# @see docs/phase-20/p7/runbooks/p7-t4-sign-off-session.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p7:t4-prep (seed · smoke · evidence · gate) =="

pnpm run p7:staging-seed-bundle
pnpm run p7:staging-remote-smoke
pnpm run p7:evidence-pack-verify

if [[ "${P7_T4_PREP_SKIP_GATE:-}" != "1" ]]; then
  pnpm run p7:gate
fi

echo "P7_T4_PREP_OK"
echo "Next: docs/phase-20/p7/runbooks/p7-t4-sign-off-session-fa.md"
