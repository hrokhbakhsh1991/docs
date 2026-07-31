# Phase 13 — Wizard plugin-neutral closure

> **Status:** DONE — 2026-06-18  
> **Prerequisite:** Phase 12 DONE · platform-core `fieldUsesCompositeRenderer` DONE  
> **Roadmap:** `TEMP/wizard-plugin-neutral-roadmap.md` (historical local scratch `wizard-plugin-neutral-roadmap.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)

## Goal

Make wizard **media upload** and **create-flow orchestration** plugin-neutral while Denali remains the reference implementation.

## Subphases

| ID | Doc | Status |
|----|-----|--------|
| 13.0 | [wizard-media-contract](subphases/13.0-wizard-media-contract.md) | **DONE** |
| 13.0b | [draft-envelope-hooks](subphases/13.0b-draft-envelope-hooks.md) | **DONE** |
| 13.1 | [api-wizard-media-dispatch](subphases/13.1-api-wizard-media-dispatch.md) | **DONE** |
| 13.2 | [bff-wizard-media-path](subphases/13.2-bff-wizard-media-path.md) | **DONE** |
| 13.3 | [api-validation-dimensions](subphases/13.3-api-validation-dimensions.md) | **DONE** |
| 13.4 | [create-page-split](subphases/13.4-create-page-split.md) | **DONE** |
| 13.5 | [wire-wizard-host-hooks](subphases/13.5-wire-wizard-host-hooks.md) | **DONE** |
| 13.6 | [wizard-boundary-guards](subphases/13.6-wizard-boundary-guards.md) | **DONE** |
| 13.7 | [neutral-remint-types](subphases/13.7-neutral-remint-types.md) | **DONE** |
| 13.8 | [remediation-closure](subphases/13.8-remediation-closure.md) | **DONE** |

## Closure

Wizard plugin-neutral path for Denali reference is complete (13.0–13.8). Urban create-flow with media remains future proof work.

## Verification

```bash
# Phase 13 regression pack (roadmap §12)
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test --test-force-exit \
  test/denali-wizard-draft-contract.spec.ts \
  test/denali-photo-upload.spec.ts \
  test/wizard-host-boundary.spec.ts \
  test/wizard-create-boundary.spec.ts \
  test/create-page-split.spec.ts \
  test/wizard-draft-envelope-hooks.spec.ts \
  test/resolve-wizard-media-bff-path.spec.ts \
  test/workspace-boundary.spec.ts \
  test/denali-draft-unification-closure.spec.ts

pnpm --filter @app-tour/workspace-sdk run build
pnpm run generate:workspace-registry --check
```

Note: full `pnpm run pre-commit:fast` may still report unrelated failures documented in [13.8 remediation](subphases/13.8-remediation-closure.md).
