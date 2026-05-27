# Denali Create Wizard — Migration Roadmap

**Status:** Complete (2026-05-27). All phases 1–5 done.

| Doc | Purpose |
|-----|---------|
| This file | Operational checklist (English) |
| [`maplog2.md`](maplog2.md) | Original Persian roadmap — all items `[x]` |
| [`MAP.MD`](MAP.MD) | Phase-by-phase execution report (Persian) |
| [`DEVELOPMENT_PLAYBOOK.md`](DEVELOPMENT_PLAYBOOK.md) | Team guide — rail layout v1/v2, draft cleanup |

---

## Current rail (layout version 2)

Source of truth: `apps/web/src/features/tours/wizard/denaliStepConfig.ts`

| Index | Step id | Component | Content |
|------:|---------|-----------|---------|
| 0 | `denali_basic` | `DenaliBasicInfoStep` | Category, dates, capacity, zones |
| 1 | `denali_photos` | `DenaliPhotosStep` | Program copy (themes, descriptions) + gallery |
| 2 | `denali_program` | `DenaliProgramNatureStep` | Outdoor metrics + daily itinerary |
| 3 | `denali_logistics` | `DenaliLogisticsStep` | Gathering, transport, gear, custom services |
| 4 | `denali_pricing` | `DenaliPricingStep` | Price + participant requirements |
| 5 | `review` | `DenaliReviewStep` | Read-only mirror of steps 0–4 |

**Legacy rail (v1):** `basic → program → logistics → pricing → photos → review`

Draft snapshots without `railLayoutVersion: 2` are remapped by **step id** on load (see `sanitizeDenaliWizardDraftSnapshot.ts`, `draft-migrator.ts`).

---

## Phase 1 — Audit & Decoupling

- [x] **Context:** `DenaliCanonicalProvider` in create (`DenaliCreateTourWizard.tsx`) and edit (`DenaliTourEditForm.tsx`)
- [x] **Validation:** No runtime dependency on step index — uses `stepId` + paths (`denali/validation/`)
- [x] **Regression baseline:** `apps/web/src/features/tours/wizard/denali/utils/denaliCanonicalTourModelFullState.spec.ts`

---

## Phase 2 — Path-Mapping

- [x] **Rail order:** `denaliStepConfig.ts` updated to v2 layout
- [x] **Path alignment:** Form→canonical aliases in `denaliCanonicalPathUtils.ts` + `denaliCanonicalPathUtils.spec.ts`
- [x] **Edit parity:** `DenaliTourEditForm` uses `getDenaliWizardSteps()` (no hardcoded order)

---

## Phase 3 — Logical Move

- [x] **3.1** `DenaliBasicInfoStep` at rail index 0
- [x] **3.2** Content + gallery at step 2 — `DenaliProgramContentSection` in `DenaliPhotosStep`; registry `program.themeIds/shortDescription/longDescription` → `denali_photos`
- [x] **3.3** Daily itinerary at step 3 — `DenaliProgramNatureStep` (outdoor + itinerary only)
- [x] **3.4** Logistics + custom services at step 4 — `DenaliLogisticsStep`
- [x] **3.5** `DenaliReviewStep` — sections `denali-review-section-{basic,photos,program,logistics,pricing}`

### Safe Relocation (tests)

- [x] Tests co-located under `apps/web/src/features/tours/wizard/denali/steps/__tests__/`
- [x] Imports updated to new structure
- [x] Path regression: `denaliCanonicalPathUtils.spec.ts`, `denaliStepRelocation.spec.ts`
- [x] Removed duplicate specs: `denaliStepNavigation`, `denaliItinerarySync`, `denaliPhotoPersistence`, `denaliThemeFilter`, `denaliAltitudeVisibility`, old `DenaliCustomServicesField.integration.test.tsx`

---

## Phase 4 — Compliance Testing

- [x] **Draft adapter:** `apps/web/src/features/tours/drafts/denali-adapter.spec.ts` (merge, step-index mapping, meaningful draft)
- [x] **Validation summary:** `denaliWizardSubmitIssuePresentation.spec.ts` + `DenaliReviewValidationSummary.integration.test.tsx`
- [x] **Focus UX:** `DenaliStepFocusBridge.integration.test.tsx` (no focus jump across steps)
- [x] **UI adapter:** `denaliUIAdapter.spec.ts` — content fields on `denali_photos`
- [x] **Submit helpers audit:** `denaliSubmitValidation.spec.ts` — `submitValidDenaliWizardDefaults()` includes `shortDescription`

---

## Phase 5 — Sanitization & Cleanup

- [x] **Ghost draft cleanup:** `sanitizeDenaliWizardDraftSnapshot.ts` wired in `denali-adapter.ts` (fetch/merge/push)
- [x] **API migration:** `packages/shared-contracts/src/draft/draft-migrator.ts` — legacy index remap + `railLayoutVersion: 2`
- [x] **Team docs:** `DEVELOPMENT_PLAYBOOK.md` — Denali rail section
- [x] **Tests:** `sanitizeDenaliWizardDraftSnapshot.spec.ts`, `draft-migrator.spec.ts`, `denaliGhostState.spec.ts`

---

## Verification commands

From `apps/web`:

```bash
# Phase 1–5 node tests (representative batch)
node --import tsx --test \
  src/features/tours/wizard/denali/utils/denaliCanonicalTourModelFullState.spec.ts \
  src/features/tours/wizard/denali/denaliCanonicalPathUtils.spec.ts \
  src/features/tours/wizard/tourWizardStepPlan.spec.ts \
  src/features/tours/edit/DenaliTourEditForm.spec.ts \
  src/features/tours/wizard/denali/steps/__tests__/*.spec.ts \
  src/features/tours/drafts/denali-adapter.spec.ts \
  src/features/tours/drafts/sanitizeDenaliWizardDraftSnapshot.spec.ts \
  src/features/tours/wizard/denali/denaliWizardSubmitIssuePresentation.spec.ts \
  src/features/tours/wizard/denali/rules/denaliUIAdapter.spec.ts \
  src/features/tours/wizard/denali/validation/denaliSubmitValidation.spec.ts \
  src/features/tours/wizard/denali/validation/denaliGhostState.spec.ts

# Jest integration
pnpm exec jest --config jest.config.cjs --runInBand \
  DenaliReviewValidationSummary.integration.test.tsx \
  DenaliStepFocusBridge.integration.test.tsx \
  DenaliLogisticsStep.integration.test.tsx
```

From repo root:

```bash
node --import tsx --test packages/shared-contracts/src/draft/draft-migrator.spec.ts
```

**Last full run:** 95/95 tests passed (83 node + 7 Jest + 5 migrator).

---

## After future registry / rail changes

1. `pnpm --filter @apps/web generate:denali-wizard`
2. Update `steps/__tests__/` and path utils specs
3. Re-run phase 4 compliance tests listed above

---

## Known non-blockers

- `denaliCanonicalTourModelFullState.spec.ts` — pre-existing TypeScript fixture typing issues; runtime tests pass
- `denali_pricing` as separate rail step — MVP decision; review mirrors it in section 5
