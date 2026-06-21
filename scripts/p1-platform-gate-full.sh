#!/usr/bin/env bash
# P1 Platform Control Center full unit gate — all platform*.spec.ts (no Playwright E2E)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== P1 structural smokes =="
node apps/api/scripts/smoke-platform-provision.mjs --help >/dev/null
node apps/web/scripts/smoke-platform-ui.mjs

echo "== P1 full API platform specs =="
pnpm --filter @apps/api exec node --import tsx --test --test-force-exit test/platform-*.spec.ts

echo "== P1 full web platform specs =="
cd apps/web
NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/platform-*.spec.ts

if [[ "${P1_LIVE_SMOKE:-}" == "1" ]]; then
  echo "== P1 live provision smoke (opt-in) =="
  bash scripts/p1-platform-live-smoke.sh
fi

echo "P1_PLATFORM_GATE_FULL_OK"
