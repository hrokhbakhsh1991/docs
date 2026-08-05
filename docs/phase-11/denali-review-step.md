# Denali review step + validation UX (Phase 11.7)

> **DEC:** [DEC-P11-008](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-008--denali-review-step--validation-ux-117)  
> **Navigation:** [`wizard-navigation.md`](wizard-navigation.md) · **Draft:** [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md)

## Purpose

Professional last wizard step: read-back summary, publish status selector, grouped validation errors with click → step + field focus.

## Review step (`stepId: "review"`)

| Piece | Location |
| ----- | -------- |
| Engine seed | `buildDenaliFullWizardTemplateSteps()` — `publishStatus` on `review` (reference / dev full template) |
| Tenant template | `buildDenaliTenantWizardTemplatePayload()` **omits** `review` + `publishStatus` (**INV-WIZ-002**) |
| Host injection | `buildVisibleWizardSteps` → `appendWorkspaceReviewStepToRenderPlan` when `wizardHost.usesReviewStep` |
| Read-back | `DenaliReviewStep` — hero + per-step summary from `contentSteps` (visible plan minus review) |
| Section edit | `onNavigateToStep` — jumps to content step; host passes `goToStepById` |
| Error summary | `DenaliReviewValidationSummary` — issues grouped by step |
| Publish gate | `DenaliPublishStatusField` — `draft` / `active` enum on `publishStatus` |

### INV-WIZ-002 review overlay (host Layer C)

Tenant Settings wizard template payloads must not include the `review` step or `publishStatus` field — they are **registry overlay** rows (`settingsSurface: "review"`), excluded from the builder palette and PUT validation.

The generic host still renders a final review step for workspaces with `usesReviewStep: true`:

```text
baseSteps (engine)
  → applyWizardTemplateToRenderPlan (tenant steps)
  → applyContextualFieldRules (Denali conditional visibility)
  → appendWorkspaceReviewStepToRenderPlan(reviewFieldCanonicalPath: "publishStatus")
```

`DenaliReviewStep` receives `contentSteps` (all visible steps except `review`) and builds sections via `buildDenaliReviewSectionsFromVisibleSteps`, which:

1. Restricts sections to step ids present in the tenant template.
2. Expands composite anchors to dependent canonical paths (transport mode → `transport.transportCost`, theme ids → descriptions, etc.).
3. Filters row-level read-back to paths that are visible on the plan.

Composite-heavy enrichments (itinerary cards, gear cards, service chips) follow the same visibility: e.g. itinerary cards only when `program.itinerary` is on the plan.

### Visual read-back (9+ parity)

Review is not a text dump of wizard labels — it mirrors composite surfaces:

| Surface | Read-back | Source |
| ------- | --------- | ------ |
| Hero | Cover thumbnail (first photo with `url` or `storageKey`) + title / category / schedule | `buildDenaliReviewHero` → `DenaliPhotoPreview` (`readOnly`) |
| Photos | Responsive grid (`denali-review__photo-grid`) with real previews + caption/day chips | `section.photos[]` from `parseDenaliTourPhotos` — **not** text cards |
| Gear | Compact list rows with required/optional badge — not generic cards | `section.gearItems[]` from `parseDenaliGearItems` |
| Itinerary | Day cards (`kind: "itinerary"`) with segment body | `program.itinerary` |
| Excluded services | Dashed self-variant cards only | `tripDetails.logistics.excludedServices` |

Section chrome uses `denali-review__section-header` (title + ghost **Edit** jump) — no `text-transform: uppercase` (FA-safe). Styles live in `packages/workspaces/denali/theme/wizard-review.css`.

`DenaliPhotoPreview` accepts `readOnly` for review surfaces: signed-url fetch still runs; retry button is hidden and fallback uses `denali-review__photo-fallback`.

Test ids: `denali-review-hero-cover`, `denali-review-photo-grid`, per-section `denali-review-edit-{stepId}`.

Submit button stays in `WizardStepShell` `lastStepFooter` (review is the last step). Create is **not** embedded inside the review composite.

## Validation

Client-side `PlatformWizardEngine.validateCanonical` on `TourWizardDraft` → `CanonicalDocument` (`wizard.roots` from Denali plugin).

| Trigger | Scope |
| ------- | ----- |
| **Continue** (non-review steps) | Violations for fields on the active step only |
| **Create tour** (review footer) | Full form; on failure → jump to first issue step + `useWizardStepValidation` focus |
| **API 400** `CANONICAL_VALIDATION_FAILED` | Same focus path when message is parseable |

Step / field lookup uses `visibleSteps` render plan (`fieldId` + `canonicalPath`), then **`wizardHost.resolveValidationStepId`** for composite dependents that never appear as standalone plan rows (INV-DENALI-WIZ-011). Without that fallback, review issue buttons and post-submit focus land on `stepId: undefined` / group `"unknown"` and cannot change steps.

When `publishStatus === "active"`, the host merges `validatePublishReadiness` violations into the live review summary (same codes as create-submit) so operators see linkable gaps before clicking Create — not only after a failed submit. Merge uses `dedupeValidationViolations` (`fieldId` + `code`) so canonical engine and readiness layers that emit the same gap do not render duplicate review rows. Create-submit (`validateDenaliCreateTourSubmitSync` / publish-transition merge) uses the same dedupe.

**Step-nav summary lifetime (INV-DENALI-WIZ-015 / WEB-WIZ-015):** After Continue fails, the host shows step-nav validation issues with `aria-invalid`. Clearing that panel must **not** key off React draft **identity** alone — remote resume, soft-lock merge, and parent `prepareEnvelope` often mint a new `draft` object with identical `data`, which previously wiped the alert before the operator could read or click issue links. Clear only when `JSON.stringify(draft.data)` changes (real edit / sanitize rewrite) or when the active step index changes. Same-payload reference churn keeps the summary.

**Step vs create heading (INV-DENALI-WIZ-017):** Step-nav summary uses `review.stepValidationHeading`; review/submit uses `review.validationHeading`. Host passes `validationHeadingKey` through `buildWizardValidationSurfaceProps`; Denali `DenaliReviewValidationSummary` must honor it (i18n keys already exist under `denali.review`).

## DOM / focus

Uses `@app-tour/wizard-navigation` (`data-field-path`) — wired via `useWizardStepValidation` in `WorkspaceWizardHost`.

## Content quality header (11.7-T9)

| Piece | Location |
| ----- | -------- |
| Weights SoT | `DENALI_FIELD_COMPLETION_WEIGHTS` in `@app-tour/workspace-denali` |
| Scoring | `computeDenaliWizardCompletion` — visible render-plan fields only; `review` step excluded; `publishStatus` weight `0` |
| UI | `DenaliWizardContentQualityHeader` above `WizardStepShell` in `WorkspaceWizardHost` (Denali only) |

## Peak experience select (11.7-T8)

`DenaliPeakExperienceField` — `participants.minRequiredPeaks` as enum Select `0`–`4` (not free numeric).

## Template prefill

When the tenant template includes `publishStatus` on the review step, prefill sets `draft` before first edit (`applyWizardTemplatePrefillToDraft`).

## Canonical submit (11.10)

Full array ingress — [`canonical-array-ingress.md`](canonical-array-ingress.md). `prepareDenaliSubmitArtifact` retains composite lists on create.

## Verification

- `apps/web/test/build-visible-wizard-steps.spec.ts`
- `apps/web/test/denali-review-format-logic.spec.ts`
- `apps/web/test/denali-wizard-validation.spec.ts`
- `apps/web/test/denali-review-step.spec.ts`
