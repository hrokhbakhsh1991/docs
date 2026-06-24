#!/usr/bin/env bash
# P10-2-N-004 — P8 four-file env regression (do not re-implement P8 bootstrap in P10)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for f in deploy/vps/env/api.env.example deploy/vps/env/web.env.example \
  deploy/vps/env/marketing.env.example deploy/vps/env/portal.env.example; do
  test -f "$f" || { echo "P10_P8_ENV_FAIL: missing $f" >&2; exit 1; }
done

test -f scripts/vps-deploy/verify-env-coherence.sh || {
  echo "P10_P8_ENV_FAIL: missing verify-env-coherence.sh" >&2
  exit 1
}

echo "== p10:p8-env-regression — p8:gate =="
pnpm run p8:gate

echo "P10_P8_ENV_REGRESSION_OK"
