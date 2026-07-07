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

echo "== p5:gate — P5-B validation VAL-01..03 + profile strip VAL-02b + catalog VAL-03 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/canonical-validation-draft-vs-publish.spec.ts \
  test/form-profile-strip.spec.ts \
  test/catalog-ref-integrity.spec.ts

echo "== p5:gate — P5-B lifecycle LC-01..03 + publish LC-04..06 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/tour-lifecycle-transition.spec.ts \
  test/tour-publish-transition.spec.ts

echo "== p5:gate — P5-B golden metadata path RP-01..04 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/workspace-metadata-denali-parity-publish.spec.ts

echo "== p5:gate — P5-B publish integration metadata path E2E-01..03 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/denali-metadata-path-publish-integration.spec.ts

echo "== p5:gate — P5-B PATCH audit AUD-02 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/tour-patch-audit.spec.ts

echo "== p5:gate — P5-B publish audit AUD-03 =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/tour-publish-audit.spec.ts

echo "== p5:gate — P5-B client/server rules parity RP-05 =="
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test \
  test/client-server-rules-parity.spec.ts

echo "== p5:gate — cutover stage CO-01..05 + MET + SMOKE + AUD =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-tenant-metadata-cutover.spec.ts \
  test/workspace-metadata-cutover-allowlist.spec.ts \
  test/workspace-metadata-cutover-metrics.spec.ts \
  test/platform-metadata-pilot-bind-smoke.spec.ts \
  test/platform-tenant-workspace-definition-audit.spec.ts

echo "== p5:gate — Super Admin cutover UI UI-01..02 =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-club-workspace-cutover-tab.spec.ts

echo "== p5:gate — P5-B operator web plugin resolve WEB-01..02 =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/operator-metadata-plugin-resolve.spec.ts

echo "== p5:gate — P5-C commerce persist + inherit + tour default =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-workspace-definition-publish.spec.ts \
  test/workspace-metadata-commerce-inherit.spec.ts \
  test/tour-create-payment-mode-default.spec.ts

echo "== p5:gate — optional EPIC exit contracts =="
pnpm --filter @apps/api exec node --import tsx --test \
  test/platform-workspace-commerce-exit.spec.ts \
  test/workspace-commerce-single-mode.spec.ts \
  test/denali-offline-receipt-unchanged.spec.ts \
  test/workspace-commerce-gateway-blocked.spec.ts \
  test/tour-create-commerce-gateway-blocked.spec.ts \
  test/platform-integrations-plane-exit.spec.ts \
  test/egress-url.spec.ts \
  test/egress-proxy-wire.spec.ts \
  test/zibal-adapter.spec.ts \
  test/stripe-v2-account.spec.ts \
  test/payments-webhook-signature.spec.ts \
  test/payments-webhook-replay.spec.ts \
  test/integrations-plane-mock.spec.ts \
  test/registration-capacity.spec.ts \
  test/paid-tour-open-gate.spec.ts \
  test/tour-created-finance-side-effect.spec.ts \
  test/platform-registrations-finance-exit.spec.ts

echo "== p5:gate — P5-D Super Admin PSP status UI-03 =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-club-psp-status.spec.ts

echo "== p5:gate — P5-C Super Admin commerce badge UI-02 =="
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-club-commerce-badge.spec.ts

echo "P5_ENTERPRISE_EVOLUTION_GATE_OK"
