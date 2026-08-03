#!/usr/bin/env bash
# P10 — production VPS four-process smoke (ports from /etc/app-tour)
# @see scripts/p10-staging-remote-gate.sh
set -euo pipefail

# Durable bind path — see app-tour-ensure-bind / deploy-vps.yml ( /opt pathname flake ).
export VPS_DEPLOY_PATH="${VPS_DEPLOY_PATH:-/srv/app-tour}"
export ENV_DIR="${ENV_DIR:-/etc/app-tour}"
export UNIT_PREFIX="${UNIT_PREFIX:-app-tour}"

exec bash "$(dirname "$0")/p10-staging-remote-gate.sh"
