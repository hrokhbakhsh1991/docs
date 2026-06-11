# Denali review step + validation UX (Phase 11.7)

> **DEC:** [DEC-P11-008](appendices/IMPLEMENTATION-DECISIONS.md#dec-p11-008--denali-review-step--validation-ux-117)  
> **Navigation:** [`wizard-navigation.md`](wizard-navigation.md) · **Draft:** [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md)

## Purpose

Professional last wizard step: read-back summary, publish status selector, grouped validation errors with click → step + field focus.

## Review step (`stepId: "review"`)

| Piece | Location |
| ----- | -------- |
| Template seed | `buildDenaliFullWizardTemplateSteps()` — `publishStatus` on `review` |
| Read-back | `DenaliReviewStep` — title, category, schedule, summary |
| Error summary | `DenaliReviewValidationSummary` — issues grouped by step |
| Publish gate | `DenaliPublishStatusField` — `draft` / `active` enum on `publishStatus` |

Submit button stays in `WizardStepShell` `lastStepFooter` (review is the last step). Create is **not** embedded inside the review composite.

## Validation

Client-side `PlatformWizardEngine.validateCanonical` on `TourWizardDraft` → `CanonicalDocument` (`wizard.roots` from Denali plugin).

| Trigger | Scope |
| ------- | ----- |
| **Continue** (non-review steps) | Violations for fields on the active step only |
| **Create tour** (review footer) | Full form; on failure → jump to first issue step + `useWizardStepValidation` focus |
| **API 400** `CANONICAL_VALIDATION_FAILED` | Same focus path when message is parseable |

Step / field lookup uses `visibleSteps` render plan (`fieldId` + `canonicalPath`).

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

- `apps/web/test/denali-wizard-validation.spec.ts`
- `apps/web/test/denali-review-step.spec.ts`
