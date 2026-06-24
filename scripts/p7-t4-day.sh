#!/usr/bin/env bash
# P7 T4 — day-of session: reset VPS + GO check + print session card
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p7:t4-day — seed reset + ready check + session card =="

pnpm run p7:t4-prep
pnpm run p7:t4-ready
echo ""
pnpm run p7:t4-session-brief

echo "P7_T4_DAY_OK"
