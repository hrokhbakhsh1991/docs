#!/usr/bin/env bash
# P10 — Profile B IP smoke regression (must stay green after Profile C work)
set -euo pipefail

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "P10_PROFILE_B_SKIP: VPS_HOST not set" >&2
  exit 0
fi

bash "$(dirname "$0")/p8-staging-remote-smoke.sh"
echo "P10_PROFILE_B_REGRESSION_OK"
