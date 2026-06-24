#!/usr/bin/env bash
# P8 — Platform surface hardening gate
# @see docs/phase-21/AGENT-START.md · appendices/P8-VERIFICATION-COMMANDS.yaml#P8-3-N-001
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${P8_SKIP_P7:-}" != "1" ]]; then
  echo "== p8:gate — P7 regression (required every P8 PR) =="
  pnpm run p7:gate
else
  echo "== p8:gate — P7 regression skipped (P8_SKIP_P7=1) =="
fi

echo "== p8:gate — P8 surface unit bundle =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/p8-pack-integrity.spec.ts \
  test/resolve-public-ingress-subdomain.spec.ts \
  test/resolve-public-tenant-label-from-host.spec.ts \
  test/public-tenant-context.spec.ts

pnpm --filter @apps/marketing exec node --import tsx --test \
  test/resolve-marketing-bootstrap.spec.ts \
  test/guest-bootstrap-parity.spec.ts

pnpm --filter @apps/portal exec node --import tsx --test \
  test/portal-middleware.spec.ts \
  test/build-session-cookie.spec.ts \
  test/resolve-portal-bootstrap.spec.ts \
  test/guest-bff-env.spec.ts \
  test/portal-member-host-bind.spec.ts

echo "P8_PLATFORM_SURFACE_GATE_OK"
