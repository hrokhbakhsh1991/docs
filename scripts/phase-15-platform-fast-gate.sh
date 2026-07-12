#!/usr/bin/env bash
# P15-P fast gate — urban wizard template seed + gate specs (<~1min)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== P15-P-D0 grep gates =="
test -f packages/workspaces/urban/src/settings/urbanMinimalWizardTemplate.ts
test -f apps/api/src/settings/seed-workspace-wizard-template.ts
test -f apps/api/src/settings/bootstrap-workspace-wizard-templates.ts
rg -q 'bootstrapWorkspaceWizardTemplatesIfNeeded' apps/api/src/main.ts
rg -q 'seedWorkspaceWizardTemplateForTenant' apps/api/scripts/db-seed.ts
rg -q 'buildUrbanMinimalWizardTemplatePayload' packages/workspaces/urban/src/index.ts
rg -q 'tour_wizard_template' packages/workspaces/urban/src/settings/urban-settings.manifest.ts
rg -q 'operatorSettings' packages/workspaces/urban/src/urban.plugin.ts
rg -q 'extractUrbanTourListProjection' packages/workspaces/urban/src/urban.plugin.ts
! test -f apps/api/src/settings/settings-workspace-guard.ts
rg -q 'resolveSettingsModuleByConfigKeyForTenant' apps/api/src/settings/settings-config.service.ts
rg -q 'operatorCapabilitySupportsUsersDirectory' apps/api/src/identity/users-workspace-guard.ts
rg -q 'fetchPublicTenantBrandingForHost' apps/web/app/api/public/tenant-branding/route.ts
! rg -q 'getDenaliWorkspacePlugin' apps/api/src/settings/settings-registry.ts
rg -q 'WORKSPACE_CANONICAL_TOUR_BINDINGS' apps/api/src/canonical/workspace-canonical-tour-bindings.generated.ts
! rg -q 'workspaceType === "denali"' apps/api/src/canonical/
! rg -q 'workspaceType === "denali"' apps/api/src/tours/tours.routes.ts
! rg -q 'workspaceType === "denali"' apps/api/src/tours/assert-tour-publish-field-owner.ts
rg -q 'assertPublishFieldOwner' apps/api/src/tours/workspace-tour-write-bindings.generated.ts

echo "== P15-P-D0 urban package tests =="
pnpm --filter @app-tour/workspace-urban run build
cd packages/workspaces/urban
NODE_ENV=test node --import tsx --test test/urban-minimal-wizard-template.spec.ts test/urban-settings-manifest.spec.ts test/urban-tour-publish-transition.spec.ts test/tour-list-projection.spec.ts

echo "== P15-P-D0 web urban gate specs =="
cd ../../../apps/web
NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/urban-wizard-template-gate.spec.ts \
  test/tenant-branding-contract.spec.ts

echo "== P15-P API specs =="
cd ../api
NODE_ENV=test node --import tsx --test --test-force-exit \
  test/seed-urban-wizard-template.spec.ts \
  test/settings-urban-wizard-template-config.spec.ts \
  test/settings-registry-tenant.spec.ts \
  test/tenant-branding.spec.ts \
  test/operator-dashboard-runtime.spec.ts \
  test/workspace-canonical-tour-dispatch.spec.ts \
  test/tour-publish-transition-audit.spec.ts \
  test/workspace-tour-write-dispatch.spec.ts

echo "PHASE_15_PLATFORM_FAST_OK"
