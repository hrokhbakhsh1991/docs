# Canonical array ingress (Phase 11.10)

> **Authority:** `prepareDenaliSubmitArtifact` / 11.7-T7 addendum  
> **Platform:** `@app-tour/workspace-sdk` `createCanonicalDocument`

## Problem

Denali wizard composites (`participants.gearItems`, `program.themeIds`, `leaderUserIds`, `gatheringPoints`, …) are **arrays** in operator draft state. Until 11.10, `createCanonicalDocument` walked data with `allowArrays: false`, so submit stripped lists via `stripArraysForCanonicalIngress` — tours persisted without gear, themes, leaders, etc.

## Platform change

`createCanonicalDocument` now validates and deep-freezes **JSON arrays** inside declared roots (same depth/key limits; sparse arrays still rejected).

| Policy | `allowArrays` |
| ------ | ------------- |
| Plugin storage ingress | `false` (unchanged) |
| Canonical document | `true` |

Implementation: `PlainObjectShieldOptions.allowArrays` + `DOCUMENT_SHIELD_OPTIONS.allowArrays: true` in `canonical-document.ts`.

## Denali submit

| Function | Role |
| -------- | ---- |
| `prepareDenaliSubmitArtifact(form)` | Alias — project wizard form → canonical `data` **with arrays** |
| `projectDenaliWizardFormToCanonicalIngressData` | Same projection (no strip) |
| `stripArraysForCanonicalIngress` | Legacy helper — retained for tests; **not** used on operator submit |

Web: `prepareDenaliTourCreatePayload` → `createCanonicalDocument` + ingress projection.

## Verification

- `packages/workspace-sdk/test/workspace-sdk.unit.spec.ts` — nested arrays accepted
- `packages/workspace-sdk/test/adversarial-canonical-ingress.spec.ts` — sparse / array-like still rejected
- `packages/workspaces/denali/test/prepare-denali-submit-artifact.spec.ts`
- `apps/web/test/denali-tour-create-payload.spec.ts` — gear survives submit
