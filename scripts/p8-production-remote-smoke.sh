#!/usr/bin/env bash
# P8 — production VPS Profile B smoke (ports 13000–13003)
# @see docs/phase-21/runbooks/p8-profile-b-vps-smoke.md
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
export P8_PROFILE_B_HOST="${VPS_HOST}"
export TOUR_OPS_API_URL="http://${VPS_HOST}:13001"
export P8_WEB_URL="http://${VPS_HOST}:13000"
export P8_MKT_URL="http://${VPS_HOST}:13002"
export P8_PTL_URL="http://${VPS_HOST}:13003"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT/scripts/smoke-p8-profile-b.mjs"
echo "P8_PRODUCTION_REMOTE_SMOKE_OK"
