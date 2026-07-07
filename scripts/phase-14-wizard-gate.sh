#!/usr/bin/env bash
# Phase 14 wizard enterprise plugin closure gate
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== Phase 14 wizard grep gates =="

! rg -q '@app-tour/workspace-denali' apps/web/src/wizard/wizard-composite-surface-registry.tsx
! rg -q '@app-tour/workspace-denali' apps/web/src/wizard/wizard-review-surface-registry.tsx
! rg -q '@app-tour/workspace-denali' apps/web/src/tours/wizard-template-field-labels.ts
! rg -q '@app-tour/workspace-denali' apps/web/src/tours/wizard-template-gate-logic.ts
! rg -q 'denali-wizard-draft-merge|resolve-denali-draft-merge' apps/web/src/wizard/wizard-draft-envelope-hooks.ts
! test -f apps/web/src/draft/denali-wizard-draft-merge.ts
! test -f apps/web/src/wizard/denali/denali-wizard-ui-context.ts
! test -f apps/web/src/wizard/denali/denali-wizard-conditional-logic.ts
! test -f apps/web/src/wizard/denali/denali-itinerary-types.ts
! test -f apps/web/src/providers/workspace-theme-stylesheet.ts
test -f apps/web/src/draft/denali-wizard-draft-types.ts
test -f packages/workspaces/denali/src/draft/resolve-denali-draft-merge.ts
! test -f apps/web/src/draft/resolve-denali-draft-merge.ts
! test -f apps/web/src/draft/denali-wizard-resume-step.ts
test -f apps/web/src/wizard/denali-wizard-draft-shell.ts
test -f apps/web/src/wizard/use-denali-create-tour-wizard.ts
! test -d apps/web/src/wizard/denali
! rg -q 'denali-catalog-sanitize' apps/web/src/wizard/workspace-create-tour-shell.tsx
! rg -q 'pluginId === "denali"' apps/web/src/tours/tour-clone-hydrate-logic.ts
! rg -q 'getDenaliWorkspacePlugin' apps/web/src/tours/tour-clone-hydrate-logic.ts
test "$(rg -c 'workspaceType !== "denali"' apps/api/src/tours/clone-photo-remint.routes.ts 2>/dev/null || echo 0)" -eq 0
test "$(rg -c 'workspaceType !== "denali"' apps/api/src/tours/tour-wizard-photos.routes.ts 2>/dev/null || echo 0)" -eq 0
test "$(wc -l < apps/web/app/tours/new/new-tour-wizard-client.tsx)" -lt 120
test "$(wc -l < apps/web/app/tours/new/denali-create-tour-wizard-client.tsx)" -lt 150
! rg -q '@app-tour/workspace-denali/theme/denali-admin' apps/web/app/layout.tsx
test -f apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts
! rg -q 'MEDIA_ROUTE_KEY_TO_BFF' apps/web/src/wizard/resolve-wizard-media-bff-path.ts
test -f apps/web/src/bootstrap/wizard-media-route-bindings.generated.ts

pnpm run generate:workspace-registry --check --strict

echo "== Web regression pack =="
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/denali-wizard-draft-contract.spec.ts \
  test/denali-photo-upload.spec.ts \
  test/wizard-host-boundary.spec.ts \
  test/workspace-boundary.spec.ts \
  test/wizard-surface-boundary.spec.ts \
  test/wizard-host-tck.spec.ts \
  test/starter-wizard-create-smoke.spec.ts \
  test/urban-wizard-create-smoke.spec.ts \
  test/tour-clone-hydrate.spec.ts \
  test/draft-unification-v3.spec.ts \
  test/denali-draft-unification-closure.spec.ts \
  test/denali-flat-edit-sync-chrome.spec.ts \
  test/denali-draft-systemic-closure.spec.ts \
  test/denali-confirm-dialog.spec.ts \
  test/denali-rules-parity.spec.ts \
  test/denali-wizard-theme.spec.ts \
  test/create-page-split.spec.ts \
  test/resolve-wizard-media-bff-path.spec.ts

echo "PHASE_14_WIZARD_DOD_OK"
