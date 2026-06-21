#!/usr/bin/env bash
# P15-W fast gate — Track W grep invariants + boundary/TCK pack (<~1min)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== P15-W grep gates =="
! test -f apps/web/src/draft/denali-wizard-draft-merge.ts
! test -f apps/web/src/wizard/denali/denali-wizard-ui-context.ts
! test -f apps/web/src/wizard/denali/denali-wizard-conditional-logic.ts
! test -f apps/web/src/wizard/denali/denali-itinerary-types.ts
! test -f apps/web/src/providers/workspace-theme-stylesheet.ts
test -f apps/web/src/draft/denali-wizard-draft-types.ts
test -f packages/workspaces/denali/src/draft/resolve-denali-draft-merge.ts
! test -f apps/web/src/draft/resolve-denali-draft-merge.ts
! test -f apps/web/src/draft/denali-wizard-resume-step.ts
test -f apps/web/src/wizard/use-denali-flat-edit-page.ts
! test -d apps/web/src/wizard/denali
test -f apps/web/src/wizard/denali-wizard-draft-shell.ts
test -f apps/web/src/tours/wizard-create-template-gate.ts
test -f apps/web/src/tours/wizard-create-prefill-hooks.ts
test -f apps/web/src/tours/tour-clone-hydrate-logic.ts
test -f apps/web/src/wizard/use-denali-create-tour-wizard.ts
test -f apps/web/src/wizard/denali-flat-edit-form-shell.tsx
! test -f apps/web/src/wizard/denali/denali-catalog-sanitize.ts
! test -f apps/web/src/wizard/denali/use-denali-wizard-rule-sync.ts
! test -f apps/web/src/wizard/denali/denali-create-tour-submit-logic.ts
! test -f apps/web/src/wizard/denali/denali-wizard-draft-edit.ts
! test -f apps/web/src/wizard/denali/denali-wizard-field-labels.ts
test -f apps/web/src/wizard/create-tour-wizard-chrome.tsx
test "$(wc -l < apps/web/app/tours/new/denali-create-tour-wizard-client.tsx)" -lt 150
! rg -q '@app-tour/workspace-denali/theme/denali-admin' apps/web/app/layout.tsx
test -f apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts
! rg -q 'MEDIA_ROUTE_KEY_TO_BFF' apps/web/src/wizard/resolve-wizard-media-bff-path.ts
test -f apps/web/src/bootstrap/wizard-media-route-bindings.generated.ts
test -f apps/web/src/bootstrap/wizard-media-backend-route-bindings.generated.ts
! rg -q 'MEDIA_ROUTE_KEY_TO_BACKEND' apps/web/src/wizard/resolve-wizard-media-backend-path.ts
! rg -q 'from "@/wizard/denali/' apps/web/src/wizard/use-denali-create-tour-wizard.ts
! rg -q 'from "@/wizard/denali/' apps/web/src/wizard/denali-wizard-draft-shell.ts
! rg -q 'from "@/wizard/denali/' apps/web/src/wizard/denali-flat-edit-form-shell.tsx
test -f apps/web/app/tours/new/denali-create-tour-wizard-client.tsx
rg -q 'ui/create-wizard' apps/web/app/tours/new/denali-create-tour-wizard-client.tsx
! test -f apps/web/src/bootstrap/denali-wizard-rules.ts
! test -f apps/web/src/bootstrap/denali-wizard-template-preset.ts
! rg -q 'from "@/wizard/use-latest-wizard-draft"' apps/web/src/wizard/use-denali-create-tour-wizard.ts apps/web/src/wizard/use-denali-flat-edit-page.ts apps/web/src/wizard/denali-wizard-draft-shell.ts apps/web/src/wizard/denali-flat-edit-form-shell.tsx
C2_IMPORT_COUNT="$(rg -c 'from "@/' apps/web/src/wizard/use-denali-create-tour-wizard.ts apps/web/src/wizard/use-denali-flat-edit-page.ts apps/web/src/wizard/denali-wizard-draft-shell.ts apps/web/src/wizard/denali-flat-edit-form-shell.tsx 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')"
! test -d apps/web/src/wizard/denali
test "${C2_IMPORT_COUNT}" -le 35
! rg -q '@/wizard/denali/' apps/
test -f apps/web/scripts/denali-draft-unification-smoke.mjs
! test -f apps/web/src/draft/draft-unification-v3-shadow.ts
test -f packages/workspaces/denali/src/draft/tombstone-shadow-log.ts
test -f apps/web/src/draft/draft-unification-v3.ts

echo "== Registry codegen =="
pnpm run generate:workspace-registry --check
node --test scripts/test/workspace-registry-drop-in.spec.mjs

echo "== P15-W boundary pack =="
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/wizard-host-boundary.spec.ts \
  test/workspace-boundary.spec.ts \
  test/wizard-host-tck.spec.ts \
  test/resolve-wizard-media-bff-path.spec.ts \
  test/denali-wizard-draft-contract.spec.ts \
  test/draft-unification-v3.spec.ts \
  test/denali-draft-unification-smoke-contract.spec.ts \
  test/urban-wizard-template-gate.spec.ts \
  test/urban-wizard-create-smoke.spec.ts

echo "PHASE_15_WIZARD_FAST_OK"
