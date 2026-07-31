# Phase 12 — Wizard platform decouple & Denali product closure

> **Status:** DONE (2026-06-11)  
> **Authority:** `TEMP/denali-wizard-enterprise-roadmap.md` (historical local scratch `denali-wizard-enterprise-roadmap.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)  
> **Prerequisite:** Phase 11 WEP closed (11.0–11.18)

## Goal

Denali remains the **first reference customer** under a **global multi-workspace wizard platform**:

- `platform-core` + `workspace-sdk` stay generic
- Denali rules/composites/draft/clone live in `packages/workspaces/denali`
- `apps/web` `WorkspaceWizardHost` consumes **`WorkspacePlugin.wizardHost`** hooks — no `pluginId === "denali"` branches for core flow
- Urban/starter attach explicit platform hooks via `createPlatformWizardHostHooks` (Phase 12.8)

## Subphases

| ID | Doc | Status |
|----|-----|--------|
| 12.0 | [wizard-plugin-hooks](subphases/12.0-wizard-plugin-hooks.md) | **DONE** |
| 12.0b | [contextual-rules-package](subphases/12.0b-contextual-rules-package.md) | **DONE** |
| 12.1 | [legacy-parity-closure](subphases/12.1-legacy-parity-closure.md) | **DONE** |
| 12.1b | [composite-field-registry](subphases/12.1b-composite-field-registry.md) | **DONE** |
| 12.2a | [submit-and-rule-context-hooks](subphases/12.2a-submit-and-rule-context-hooks.md) | **DONE** |
| 12.2b | [edit-preset-patch](subphases/12.2b-edit-preset-patch.md) | **DONE** |
| 12.2 | denali-edit-preset-builder | **DONE** (12.2a + 12.2b) |
| 12.3 | [enterprise-publish-edit-autosave](subphases/12.3-enterprise-publish-edit-autosave.md) | **DONE** |
| 12.4 | [denali-flat-edit-form](subphases/12.4-denali-flat-edit-form.md) | **DONE** (incl. 12.4d autosave, 12.4e cancel/unpublish) |
| 12.5 | [guide-languages-wizard](subphases/12.5-guide-languages-wizard.md) | **DONE** |
| 12.6 | [publish-readiness-validation](subphases/12.6-publish-readiness-validation.md) | **DONE** |
| 12.7 | [publish-transition-audit](subphases/12.7-publish-transition-audit.md) | **DONE** |
| 12.8 | [urban-starter-wizard-hooks](subphases/12.8-urban-starter-wizard-hooks.md) | **DONE** |
| 12.9 | [wizard-host-remediation](subphases/12.9-wizard-host-remediation.md) | **DONE** |

## Product routing (Denali)

| Flow | UX | Route |
|------|-----|-------|
| Create | Multi-step wizard | `/tours/new` |
| Edit | Flat single-page form (no wizard) | `/tours/[id]/edit` |
| Duplicate | Wizard prefill | `/tours/new?clone=` |

## Verification (fast-track)

```bash
pnpm run pre-commit:fast
pnpm --filter @app-tour/platform-core run build
pnpm --filter @app-tour/workspace-sdk run build
pnpm --filter @app-tour/workspace-denali run build
pnpm --filter @app-tour/workspace-urban run build
pnpm --filter @app-tour/platform-core run test -- test/platform-wizard-host-hooks.spec.ts
pnpm --filter @app-tour/workspace-urban run test -- test/urban-wizard-host-hooks.spec.ts
pnpm --filter @app-tour/workspace-starter run test -- test/sdk-reference-parity.spec.ts src/starter.plugin.spec.ts
cd apps/web && node --import tsx --test test/denali-wizard-validation.spec.ts test/denali-rules-parity.spec.ts
```
