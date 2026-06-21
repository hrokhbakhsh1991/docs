#!/usr/bin/env bash
# P5 — Enterprise Evolution gate (agent pack + cutover contract)
# @see TEMP/p5/AGENT-START.md · docs/phase-18/
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== p5:gate — import boundary =="
pnpm run guard:import-boundary

echo "== p5:gate — denali covenant =="
pnpm run guard:p3-denali-covenant

echo "== p5:gate — doc integrity DOC-SYNC =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/p5-doc-integrity.spec.ts

echo "== p5:gate — agent pack + anti-drift =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-enterprise-evolution-exit.spec.ts \
  test/p5-anti-drift-contract.spec.ts

echo "== p5:gate — preservation + P5-core exit =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/p5-preservation-gate.spec.ts \
  test/platform-denali-operator-parity-exit.spec.ts

echo "== p5:gate — cutover stage CO-01..05 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-tenant-metadata-cutover.spec.ts \
  test/workspace-metadata-cutover-allowlist.spec.ts

echo "== p5:gate — optional EPIC exit contracts =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-workspace-commerce-exit.spec.ts \
  test/platform-integrations-plane-exit.spec.ts \
  test/platform-registrations-finance-exit.spec.ts

echo "P5_ENTERPRISE_EVOLUTION_GATE_OK"
