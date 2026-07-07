#!/usr/bin/env bash
# P9 — Code consolidation gate (static; behavioral via verification YAML)
# @see docs/phase-22/AGENT-START.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p9:gate — P8 regression (required every P9 PR) =="
pnpm run p8:gate

if rg 'hostname\.includes' apps/marketing apps/portal --glob "*bootstrap*" >/dev/null 2>&1; then
  echo "p9:gate FAIL — hostname pluginId heuristic still in M+P bootstrap" >&2
  exit 1
fi

echo "== p9:gate — P9-1-N-001 web public-auth removed =="
if find apps/web/app/api/public-auth -name route.ts 2>/dev/null | grep -q .; then
  echo "p9:gate FAIL — web app/api/public-auth routes still exist" >&2
  exit 1
fi

echo "== p9:gate — session-client package =="
pnpm --filter @app-tour/session-client run build
pnpm --filter @app-tour/session-client run test

echo "== p9:gate — P9-0-N-002 wiring =="
rg "@app-tour/session-client" apps/web apps/portal --glob "*.ts" >/dev/null
if rg "@app-tour/session-client" apps/marketing --glob "*.ts" >/dev/null 2>&1; then
  echo "p9:gate FAIL — marketing must not import session-client" >&2
  exit 1
fi
if rg "decode-jwt-payload" apps/web apps/portal --glob "*.ts" >/dev/null 2>&1; then
  echo "p9:gate FAIL — duplicate decode-jwt-payload in apps" >&2
  exit 1
fi

echo "== p9:gate — guest-surface-host package =="
pnpm --filter @app-tour/guest-surface-host run build
pnpm --filter @app-tour/guest-surface-host run test

echo "== p9:gate — P9-0-N-001 wiring =="
rg "@app-tour/guest-surface-host" apps/marketing apps/portal --glob "*.ts" >/dev/null
if rg "guest-surface-host" apps/web --glob "*.ts" >/dev/null 2>&1; then
  echo "p9:gate FAIL — web must not import guest-surface-host" >&2
  exit 1
fi
if rg "resolve-host-tenant" apps/marketing apps/portal --glob "*.ts" >/dev/null 2>&1; then
  echo "p9:gate FAIL — M+P must not keep local resolve-host-tenant" >&2
  exit 1
fi

echo "== p9:gate — P9-3-N-001 surface boundary =="
pnpm run guard:p9-surface-boundary

echo "== p9:gate — P9 pack integrity =="
pnpm --filter @apps/api exec node --import tsx --test test/p9-pack-integrity.spec.ts

echo "P9_CODE_CONSOLIDATION_GATE_OK"
