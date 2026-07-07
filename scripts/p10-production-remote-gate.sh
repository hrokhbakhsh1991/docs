#!/usr/bin/env bash
# P10 — production VPS four-process smoke (ports from /etc/app-tour)
# @see scripts/p10-staging-remote-gate.sh
set -euo pipefail

export VPS_DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour}"
export ENV_DIR="${ENV_DIR:-/etc/app-tour}"
export UNIT_PREFIX="${UNIT_PREFIX:-app-tour}"

exec bash "$(dirname "$0")/p10-staging-remote-gate.sh"
