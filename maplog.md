
## 52. Wizard Step Audit

**Scope:** Denali create wizard (`DenaliCreateTourWizard`). Inventory only — no code moves.  
**Sources:** `denaliStepConfig.ts`, step components under `apps/web/src/features/tours/wizard/denali/steps/`, `denaliFieldRegistryData.ts`, `denaliRuleSet.generated.ts`, submit/validation plumbing.

---

### 1. Current state inventory

#### 1.1 Rail steps (authoritative order)

Defined in `denaliWizardSteps` (`denaliStepConfig.ts`):

| Index | Step ID | FA title | Body component |
|------:|---------|----------|----------------|
| 0 | `denali_basic` | اطلاعات پایه | `DenaliBasicInfoStep` |
| 1 | `denali_photos` | عکس‌ها | `DenaliPhotosStep` (+ embedded `DenaliProgramContentSection`) |
| 2 | `denali_program` | برنامه | `DenaliProgramNatureStep` (+ `DenaliItineraryStep`, `DenaliDailyItinerarySection`) |
| 3 | `denali_logistics` | لجستیک و خدمات | `DenaliLogisticsStep` |
| 4 | `denali_pricing` | هزینه | `DenaliPricingStep` (+ `DenaliPricingParticipantSection`) |
| 5 | `review` | بازبینی و ثبت | `DenaliReviewStep` |

**Removed historical steps** (not on rail): `denali_participants`, `denali_policies`, `denali_transport` (renamed → logistics).

`DenaliCreateTourWizard` maps steps in `DenaliStepBody` switch; `DenaliStepFocusBridge` attaches per-step focus containers (`data-testid`: `denali-step-basics`, `denali-step-photos`, `denali-step-program`, `denali-step-logistics`, `denali-step-pricing`, `denali-step-review`).

---

#### 1.2 Fields rendered per step (UI reality)

Registry `stepId` ≠ always “only place user can edit” (e.g. `publishStatus` is registry/basic but edited on **review**). Below lists **what is actually mounted** in step components.

##### `denali_basic` — `DenaliBasicInfoStep`

| UI control | RHF / canonical (primary) | Rule-gated |
|------------|---------------------------|------------|
| Category (mountain/nature/desert/event) | `basicInfo.tourType` → `category` | yes |
| Title | `basicInfo.title` | yes |
| Duration (single/multi) | `basicInfo.tourType` → `duration` | yes |
| Event variant (cinema/reading) | `basicInfo.tourType` → `eventVariant` | yes |
| Destination combobox | `basicInfo.destinationId` | yes |
| Peak height (m) | `tripDetails.overview.peakHeight` | yes (mountain) |
| Workspace leaders (multi) | `basicInfo.leaderUserIds` | yes |
| Requires local guide | `basicInfo.requiresLocalGuide` | yes |
| Local guide name | `basicInfo.localGuideName` | yes (when guide) |
| Start datetime | `basicInfo.startDateTime` | always |
| End datetime | `basicInfo.endDateTime` | yes (multi-day) |
| Capacity max / min | `basicInfo.capacityMax`, `capacityMin` | yes |
| Approximate return time | `basicInfo.approximateReturnTime` | component always |
| Social link | `basicInfo.socialMediaLink` | yes |
| Manual admin approval | `basicInfo.requiresManualAdminApproval` | always (checkbox) |

**In registry but not on basic step UI:** `meetingPoint`, `startPointLocationText`, `publishStatus` (publish on review).

##### `denali_photos` — `DenaliPhotosStep` + `DenaliProgramContentSection`

| UI control | RHF / canonical |
|------------|-----------------|
| Photo upload grid | `photosData.photos` → `photos` |
| Theme checkboxes | `programNature.themeIds` |
| Short description | `programNature.shortDescription` |
| Long description | `programNature.longDescription` |

##### `denali_program` — `DenaliProgramNatureStep`

| UI control | RHF / canonical | Rule-gated |
|------------|-----------------|------------|
| Difficulty slider 1–10 | `programNature.difficultyLevel` | outdoor block |
| Hiking hours (approx) | `programNature.hikingHoursApprox` | outdoor block |
| Go / return hours | `programNature.hikingGoHours`, `hikingReturnHours` | outdoor block |
| Elevation gain | `tripDetails.metrics.elevationGain` | `DenaliItineraryStep` |
| Daily itinerary | `programNature.itinerary` | multi-day |

##### `denali_logistics` — `DenaliLogisticsStep`

| UI control | RHF / canonical | Rule-gated |
|------------|-----------------|------------|
| Gathering points widget | `tripDetails.logistics.gatheringPoints` | yes |
| Location zones (start/summit/camp/end) | `basicInfo.*Point` | yes |
| Gear section (required/optional) | `participantRequirements.gearItems` | yes |
| Transport mode | `transport.transportMode` | always |
| Transport cost | `transport.transportCost` | contextual |
| Allow personal car | `transport.allowPersonalCar` | contextual |
| Dong amount | `transport.dongAmount` | contextual |
| Admin capacity approval | `transport.adminCapacityApproval` | contextual |
| Custom service labels | `tripDetails.overview.customServiceLabels` | capability |

**In registry, not rendered on logistics UI:** `transport.transportNotes`, `transport.seatPreference` (train seat).

##### `denali_pricing` — `DenaliPricingStep` + `DenaliPricingParticipantSection`

**Pricing / payment block (`DenaliPricingStep`):**

| UI control | RHF / canonical | Notes |
|------------|-----------------|-------|
| Offline-only hint (text) | — | static |
| Requires payment | `pricingPayment.requiresPayment` → `pricing.requiresPayment` | always |
| Base price per person | `pricingPayment.basePricePerPerson` | when `requiresPayment` |
| Includes tour insurance | `pricingPayment.includesTourInsurance` | always |
| Non-attendance details | `tripDetails.overview.nonAttendanceDetails` | when tour type selected |

**Registry on pricing, not in pricing UI:** `pricing.paymentMode` — required in rule model; **hard-coded** to `"offline_receipt"` in `denaliCanonicalFormAdapter` (no visible control).

**Participant / peak block (`DenaliPricingParticipantSection` + `DenaliPeakExperienceField`):**

| UI control | RHF / canonical | Visibility |
|------------|-----------------|------------|
| Min required peaks (auto-approval) | `participantRequirements.minRequiredPeaks` | `peakExperienceVisible` predicate + rules |
| Minimum / maximum age | `participantRequirements.minimumAge/maximumAge` | mountain matrix |
| Fitness level | `participantRequirements.fitnessLevel` | mountain matrix |
| National ID required | `participantRequirements.nationalIdRequired` | rules (visible all categories in matrix) |
| Sports insurance | `participantRequirements.sportsInsuranceRequired` | mountain matrix |
| Fitness prerequisite text | `participantRequirements.fitnessPrerequisiteText` | shown whenever participant block visible (**no** `isVisible` on field alone) |

**Policies / terms block (same section, gated by `isVisible("policies.policiesText")`):**

| UI control | RHF / canonical | Label (FA) |
|------------|-----------------|------------|
| Policies notes | `policies.policiesText` | policies.notes |
| Cancellation deadline (hours) | `policies.cancellationDeadlineHours` | policies.cancellationDeadlineHours |
| Cancellation penalty (%) | `policies.cancellationPenaltyPercentage` | policies.cancellationPenaltyPercentage |

These three share registry tag `policies_pricing` and matrix recipe inclusion on **all** category×duration cells — they are the **Rules/Terms content currently mixed into the Pricing step**.

##### `review` — `DenaliReviewStep`

- Publish status control (`TourPublishStatusField`) — `basicInfo.publishStatus`
- Read-only mirrors for all prior steps (sections per `getDenaliStepTitleFa`)
- `DenaliReviewValidationSummary` (submit gate issues)
- `DenaliReviewParticipantsDisplay` (participant summary)
- Pricing review section includes policies rows when populated

---

#### 1.3 Registry rows with `stepId: "denali_pricing"` (canonical paths)

| Canonical path | RHF path | Tags / notes |
|----------------|----------|--------------|
| `tripDetails.overview.nonAttendanceDetails` | `tripDetails.overview.nonAttendanceDetails` | `inRuleModel: false`; contextual when tour type set |
| `pricing.requiresPayment` | `pricingPayment.requiresPayment` | core |
| `pricing.basePricePerPerson` | `pricingPayment.basePricePerPerson` | contextual on requiresPayment |
| `pricing.paymentMode` | `pricingPayment.paymentMode` | required; **no UI** |
| `pricing.includesTourInsurance` | `pricingPayment.includesTourInsurance` | `inRuleModel: false` |
| `participants.nationalIdRequired` | `participantRequirements.nationalIdRequired` | core |
| `policies.cancellationDeadlineHours` | `policies.cancellationDeadlineHours` | **`policies_pricing`** |
| `policies.cancellationPenaltyPercentage` | `policies.cancellationPenaltyPercentage` | **`policies_pricing`** |
| `policies.policiesText` | `policies.policiesText` | **`policies_pricing`** |
| `participants.minimumAge` | `participantRequirements.minimumAge` | `mountain_participants` |
| `participants.maximumAge` | `participantRequirements.maximumAge` | `mountain_participants` |
| `participants.fitnessLevel` | `participantRequirements.fitnessLevel` | `mountain_participants` |
| `participants.sportsInsuranceRequired` | `participantRequirements.sportsInsuranceRequired` | `mountain_participants` |
| `participants.fitnessPrerequisiteText` | `participantRequirements.fitnessPrerequisiteText` | `mountain_participants` |
| `participants.minRequiredPeaks` | `participantRequirements.minRequiredPeaks` | `peakExperienceVisible`; `inRuleModel: false` |

Generated rule matrix (`denaliRuleSet.generated.ts`) assigns the same `step: "denali_pricing"` for all pricing + policies + mountain participant paths per cell.

---

#### 1.4 Rules/Terms mixed into Pricing (summary)

| Concern | Location today | User-facing section |
|---------|----------------|---------------------|
| Cancellation policy notes | `policies.policiesText` | Bottom of `DenaliPricingParticipantSection` |
| Cancellation deadline hours | `policies.cancellationDeadlineHours` | Same |
| Cancellation penalty % | `policies.cancellationPenaltyPercentage` | Same |
| Non-attendance admin note | `tripDetails.overview.nonAttendanceDetails` | `DenaliPricingStep` (pricing-adjacent, not `policies.*`) |

There is **no** dedicated Legal/Terms rail step; `denali_policies` was removed per `DENALI_MVP_REMOVED_STEPS`.

---

### 2. Analysis — splitting Rules/Terms to a new Legal step

#### 2.1 Will `denaliSubmitValidation.ts` / canonical model break?

| Layer | Break risk | Detail |
|-------|------------|--------|
| **Canonical Zod** (`denaliCanonicalTourSchema.unified`) | **Low** | `policies` is already a first-class slice (`denaliCanonicalPoliciesSchema`: `policiesText`, `cancellationDeadlineHours`, `cancellationPenaltyPercentage`). Step placement is UI/registry only. |
| **Submit gate** (`evaluateDenaliWizardSubmitGate` → `getDenaliWizardSubmitIssues` + publish readiness) | **Low if registry/rule matrix updated** | Validates **full form → canonical**, not per-step DOM. Issues stay valid as long as paths unchanged. |
| **Step-scoped validation** (`getDenaliWizardStepIssues`, `getDenaliStepPickShape`) | **Medium** | `getDenaliStepPickShape` includes form sections based on `field.step` in `denaliRuleSet`. Moving policies fields without updating generated `step` leaves `policies` validated only on submit, not on intermediate “Next” for the new step. |
| **Structural invariants** (`clearWhenNotVisible`) | **Low** | Policies fields do not currently use `structuralInvariant` in registry; no auto-clear on hide. |
| **Adapter / API payload** (`denaliCanonicalFormAdapter`, `buildDenaliCreateTourPayloadProjection`) | **Low** | Maps `form.policies.*` ↔ `canonical.policies.*` regardless of wizard step. |

**Conclusion:** Canonical model and active submit gate **do not inherently break**. Risk is **wizard orchestration**: step index, per-step Zod pick, issue routing, draft `currentStepIndex`, and field-group metadata must be updated together.

#### 2.2 Canonical paths to move to a hypothetical `denali_legal` (or `denali_terms`) step

**Primary candidates (true policies / terms):**

- `policies.policiesText`
- `policies.cancellationDeadlineHours`
- `policies.cancellationPenaltyPercentage`

**Optional / product decision (not `policies.*` but policy-adjacent):**

- `tripDetails.overview.nonAttendanceDetails` — currently `stepId: denali_pricing`; legal/compliance copy vs pricing note.

**Should likely stay on Pricing / Participants:**

- All `pricing.*` paths
- All `participants.*` paths (including `minRequiredPeaks`)
- `participants.nationalIdRequired` (identity requirement, not cancellation terms)

**Not on any step UI today but registry-pricing:**

- `pricing.paymentMode` — if Legal step is payment-terms only, keep on pricing or document as derived constant.

#### 2.3 Reactivity / submission-gate pitfalls when splitting

1. **`resolveStepForIssue` fallback** (`denaliWizardSubmitIssuePresentation.ts`): `policies.*` and `participantRequirements.*` both hard-map to `denali_pricing`. After split, policies issues must map to the new step or error links jump to wrong rail index.
2. **`hydrateBackendErrorsToWizardTargets`**: no `policies.` prefix in `FORM_PATH_TO_STEP` — backend policy errors may fall through to `review`.
3. **`useDenaliStepFieldRules("denali_pricing")`**: `DenaliPricingParticipantSection` gates policies via `isVisible("policies.policiesText")`; new step needs its own hook instance + watches.
4. **`DENALI_STEP_TO_FIELD_GROUPS`**: `denali_pricing` includes `policies` group; review also lists `policies`. New step needs group mapping.
5. **Draft sanitization** (`sanitizeDenaliWizardDraftSnapshot.ts`): allowlist includes `denali_pricing`; add new step id.
6. **Wizard completion weights** (`denaliFieldCompletionWeights.ts`): policies paths keyed by canonical path — unaffected by step id unless completion is step-scoped.
7. **Regenerate artifacts**: `pnpm --filter web generate:denali-wizard` after `stepId` changes in `denaliFieldRegistryData.ts` + matrix recipes (`policies_pricing` tag may become `policies_legal`).
8. **Review step**: `DenaliReviewStep` pricing section renders policies — may need a Legal review section or retain mirror under pricing title.
9. **Peak field dependency**: `minRequiredPeaks` visibility depends on `basicInfo.requiresManualAdminApproval` (basic step) + tour type — cross-step reactivity already exists; Legal split does not remove this coupling.

---

### 3. Dependencies hard-coded to `denali_pricing`

| File | Coupling |
|------|----------|
| `denaliStepConfig.ts` | Rail definition + comments placing participants/policies on pricing |
| `DenaliCreateTourWizard.tsx` | `case "denali_pricing": <DenaliPricingStep />` |
| `DenaliPricingStep.tsx` | `const STEP = "denali_pricing"` |
| `DenaliPricingParticipantSection.tsx` | `useDenaliStepFieldRules("denali_pricing")`; policies + participants UI |
| `DenaliPeakExperienceField.tsx` | `PRICING_STEP = "denali_pricing"` + `isVisible("participantRequirements.minRequiredPeaks")` |
| `DenaliStepFocusBridge.tsx` | `denali-step-pricing` test id |
| `denaliFieldRegistryData.ts` | All pricing/participant/policy registry `stepId` |
| `denaliRuleSet.generated.ts` | Generated `step: "denali_pricing"` rows (**regen required**) |
| `denaliWizardSubmitIssuePresentation.ts` | Prefix fallback: `policies.`, `participantRequirements.`, `pricingPayment.` → `denali_pricing` |
| `hydrateBackendErrorsToWizardTargets.ts` | `pricingPayment.` → `denali_pricing` only |
| `denaliWizardFieldGroups.ts` | `denali_pricing: [pricing_capacity, participation, policies]` |
| `schemas/denaliTourCreateValidation.ts` | Step list includes `denali_pricing` for pick shape |
| `DenaliReviewStep.tsx` | Review section title `getDenaliStepTitleFa("denali_pricing")` includes policies display |
| `DenaliTourEditForm.tsx` | Edit wizard step switch includes `denali_pricing` |
| `sanitizeDenaliWizardDraftSnapshot.ts` | Allowed step ids |
| Tests: `denaliRuleModel.spec.ts`, `predicates.spec.ts`, `evaluateFormRules.spec.ts`, `denaliStepConfig.spec.ts`, `tourWizardStepPlan.spec.ts`, `denali-adapter.spec.ts`, `DenaliPricingStep.integration.test.tsx` | Assert pricing step behavior |

**`useDenaliStepFieldRules` itself** is step-agnostic (parameterized); only **call sites** pass `"denali_pricing"`.

**`denaliSubmitValidation.ts`** — no direct `denali_pricing` string; safe if issue routing + rule matrix stay aligned.

---

### 4. Recommended split checklist (for implementation phase)

1. Add `denali_legal` (or reuse resurrected `denali_policies` id) to `denaliWizardSteps` and titles.
2. Move registry `stepId` for three `policies.*` paths (+ optional `nonAttendanceDetails`).
3. Run `generate:denali-wizard`; fix `denaliRuleModel.spec.ts` expectations.
4. Extract `DenaliLegalTermsStep` (or move policies block out of `DenaliPricingParticipantSection`).
5. Update `resolveStepForIssue`, `hydrateBackendErrorsToWizardTargets`, `DENALI_STEP_TO_FIELD_GROUPS`.
6. Update `DenaliReviewStep` section layout.
7. Re-run submission integration test + step navigation/focus tests.

---

*Audit date: 2026-05-28. No code moved.*

