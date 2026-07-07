#!/usr/bin/env bash
# P7-0 — staging / live infra verification (product regression + optional host smoke)
# @see docs/phase-20/p7/runbooks/p7-0-staging-walkthrough.md
# Ports: docs/phase-20/p7/appendices/P7-PORT-MATRIX.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_DIR="${ENV_DIR:-/etc/app-tour}"

# Profile A default; VPS Profile B uses 3001 — always set TOUR_OPS_API_URL on VPS.
API_URL="${TOUR_OPS_API_URL:-http://127.0.0.1:4000}"

echo "== p7:staging-verify — product gate (P6 regression) =="
if [[ "${P7_FAST:-}" == "1" ]]; then
  echo "p7:staging-verify: skip p7:gate (P7_FAST=1 · run locally or TEMP/FOR YOU.md)"
else
  pnpm run p7:gate
fi

if [[ -f "${ENV_DIR}/api.env" && -f "${ENV_DIR}/web.env" ]]; then
  echo "== p7:staging-verify — VPS env coherence =="
  if [[ -f "${ENV_DIR}/marketing.env" && -f "${ENV_DIR}/portal.env" ]]; then
    bash scripts/vps-deploy/verify-env-coherence.sh --all
  else
    bash scripts/vps-deploy/verify-env-coherence.sh
  fi
fi

health_url="${API_URL%/}/health"
if curl -fsS --max-time 5 "$health_url" >/dev/null 2>&1; then
  echo "== p7:staging-verify — host tenant bind (SMK-P6-HOST-01) =="
  TOUR_OPS_API_URL="$API_URL" node scripts/smoke-p6-host-bind.mjs

  if [[ -f "${ENV_DIR}/marketing.env" ]]; then
    mkt_port="$(grep -E '^PORT=' "${ENV_DIR}/marketing.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || echo 3002)"
    mkt_url="http://127.0.0.1:${mkt_port}/health"
    if curl -fsS --max-time 5 "$mkt_url" >/dev/null 2>&1; then
      echo "p7:staging-verify: marketing health OK (${mkt_url})"
    else
      echo "p7:staging-verify: FAIL marketing not reachable at ${mkt_url}" >&2
      exit 1
    fi
  fi

  if [[ -f "${ENV_DIR}/portal.env" ]]; then
    ptl_port="$(grep -E '^PORT=' "${ENV_DIR}/portal.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || echo 3003)"
    ptl_url="http://127.0.0.1:${ptl_port}/health"
    if curl -fsS --max-time 5 "$ptl_url" >/dev/null 2>&1; then
      echo "p7:staging-verify: portal health OK (${ptl_url})"
    else
      echo "p7:staging-verify: FAIL portal not reachable at ${ptl_url}" >&2
      exit 1
    fi
  fi

  if [[ -f "${ENV_DIR}/marketing.env" && -f "${ENV_DIR}/portal.env" ]]; then
    echo "== p7:staging-verify — four-process smoke =="
    ENV_DIR="$ENV_DIR" bash scripts/vps-deploy/smoke-four-process.sh
  fi
else
  echo "p7:staging-verify: skip host smoke — API not reachable at ${health_url}"
  echo "  set TOUR_OPS_API_URL (Profile A: :4000 · VPS Profile B: http://127.0.0.1:3001)"
fi

echo "P7_STAGING_VERIFY_OK"
