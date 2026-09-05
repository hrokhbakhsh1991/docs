#!/usr/bin/env bash
# P10 — remote staging gate (loopback 4/4 + Profile B regression)
# Usage: VPS_HOST=89.42.210.252 pnpm run p10:staging-gate
set -euo pipefail

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "P10_STAGING_GATE_FAIL: VPS_HOST not set" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p10:staging-gate — static Profile C env =="
bash scripts/p10-profile-c-env-check.sh

echo "== p10:staging-gate — remote four-process =="
bash scripts/p10-staging-remote-gate.sh

echo "== p10:staging-gate — Profile B regression =="
bash scripts/p10-profile-b-regression.sh

echo "P10_STAGING_GATE_OK"
