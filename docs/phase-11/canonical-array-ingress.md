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

## Engine field registry (Phase 11 — `buildDenaliWorkspaceFieldRegistry`)

`PlatformWizardEngine.validateCanonical` reads `plugin.fieldRegistry.fields[].kind` to assert **stored canonical shape**, not React widget shape.

| Registry row | `field.id` | `field.kind` |
| ------------ | ---------- | ------------ |
| Scalar composite widget (tour kind, destination, datetime, …) | `denali.*` renderer id when present | **Scalar** from `primitiveKindForZodKind` (`enum`, `text`, `number`, `date`, `boolean`) |
| Array ingress (`themeIds`, `gearItems`, `photos`, `itinerary`, …) | `denali.*` renderer id | **`composite`** — `@app-tour/platform-core` accepts JSON arrays at composite paths (Phase 11.10); wizard render plan keeps the step |

**Invariant INV-DENALI-INGRESS-001:** composite renderer id (`field.id = denali.tour-kind-basics`) must not force `kind: composite` when the canonical path stores a scalar. Forcing composite caused API `POST /tours` to fail with `CANONICAL_VALIDATION_FAILED: Canonical path "category" expects kind "composite" but got string` even when client publish-readiness passed.

`buildDenaliCanonicalShell` keeps `null` scalar root shells for `createCanonicalDocument` root completeness. Platform hidden-field poison treats `null` like unset (not a smuggled value) so optional hidden datetime fields validate after scalar kind correction.

SDUI render plan still receives `uiHints.compositeId` from `field.id` when it differs from `canonicalPath` (`platform-core` render-plan).

## Verification

- `packages/workspace-sdk/test/workspace-sdk.unit.spec.ts` — nested arrays accepted
- `packages/workspace-sdk/test/adversarial-canonical-ingress.spec.ts` — sparse / array-like still rejected
- `packages/workspaces/denali/test/prepare-denali-submit-artifact.spec.ts`
- `packages/workspaces/denali/test/denali-field-registry-kind.spec.ts` — INV-DENALI-INGRESS-001 / `denali_photos` step regression guard
- `packages/platform-core/test/unit/utils/canonical-value.spec.ts` — composite JSON array acceptance
- `packages/platform-core/test/unit/utils/canonical-path.spec.ts` — `isEmptyCanonicalValue` for composite arrays
- `apps/web/test/denali-tour-create-payload.spec.ts` — gear survives submit
- `apps/api/test/canonical-validation-draft-vs-publish.spec.ts` — `tour-publish-ready.json` passes `validateCanonicalBeforePersistSync` in publish mode
