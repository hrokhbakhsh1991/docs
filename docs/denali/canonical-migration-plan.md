# Denali Canonical Migration Plan (Phase 4 Cutover)

**Status:** Planning only — no cutover activated.  
**Phase 4 step 1–2 complete:** flat `DenaliCanonicalTourModel`, `denaliCanonicalFromForm`, rule/UI canonical adapters, `denaliCanonicalTourSchema`, `canonicalToCreateTourPayload`, shadow validator (non-blocking).  
**Phase 4 step 2 comment:** canonical rule source prepared but not activated in UI.

---

## 1. Current `DenaliCreateTourWizardForm` dependency map

The legacy form is defined in `apps/web/src/features/tours/wizard/schemas/denaliTourCreateSchema.ts` (`denaliTourCreateBaseSchema` + preprocess + structural refine + compiled rule engine). Everything below still reads or writes that shape unless noted.

### 1.1 `basicInfo.tourType` (8-slug `denaliTourKind` adapter)

| Area | Files |
|------|--------|
| **Schema / defaults** | `schemas/denaliTourCreateSchema.ts`, `schemas/denaliTourCreateSchema.spec.ts` |
| **Validation / rules** | `denali/validation/denaliRuleValidation.ts`, `denali/rules/denaliRuleModel.ts` (`basicInfo.tourType` in rule fields), `denali/rules/denaliZodCompiler.ts` |
| **UI — basics** | `denali/steps/DenaliBasicInfoStep.tsx` (watch + `patchDenaliCanonicalBasics` → writes slug) |
| **UI — review** | `denali/steps/DenaliReviewStep.tsx` (`readDenaliCanonicalBasics`) |
| **UI rules** | `denali/DenaliCanonicalContext.tsx` (`getDenaliUIFromForm`), `denali/denaliCanonicalBasicsControl.ts` |
| **Normalize** | `denaliTourCreateSchema.ts` (`normalizeDenaliWizardForm` uses slug for multi-day end clear) |
| **Submit / API** | `domain/mapDenaliWizardToCreateTourPayload.ts` → `tripDetails.overview.denaliTourKind` |
| **Clone / prefill** | `clone/transformTourToDenaliWizardValues.ts`, `presetDefaultsToDenaliFormPatch.ts`, `profiles/denali/mapToDenaliWizardPatch.ts`, `profiles/mapPresetToFormPatch.ts`, `sources/loadWizardPrefill.ts` |
| **Derived helpers** | `denali/denaliWizardDerived.ts` (all derive* from slug) |
| **Tests / QA** | `profiles/denali/mapToDenaliWizardPatch.spec.ts`, `presetDefaultsToDenaliFormPatch.spec.ts`, `denali/denaliWizardDerived.spec.ts`, integration `real-tenant.helpers.ts`, `scripts/qa-denali-owner-matrix.ts` |
| **API (persisted)** | `apps/api/.../trip-details.dto.ts`, `assert-create-tour-invariants.ts` (validates `overview.denaliTourKind`) |

**Canonical path (additive, not wired to UI):** `packages/types/src/denali/denaliCanonicalFromForm.ts`, `denali/rules/denaliCanonicalRuleAdapter.ts` (`getDenaliRulesFromCanonical`).

---

### 1.2 `isMultiDay` (derived; occasionally ghost field on patches)

| Area | Files |
|------|--------|
| **Not in Zod schema** | Removed from active schema; derived via `denaliTourKindToIsMultiDay(tourType)` |
| **Ghost strip** | `denali/denaliFormSanitize.ts` (`STRIP_BASIC`), `denali/denaliFormSanitize.spec.ts` |
| **Derived export** | `denali/denaliWizardDerived.ts` → `selectDenaliWizardDerived().isMultiDay` |
| **Clone** | `clone/transformTourToDenaliWizardValues.ts` (infers multi-day from logistics + slug) |
| **API payload** | Set implicitly via slug in mapper; API DTO uses `durationDays` / logistics dates |
| **Types (nested legacy)** | `packages/types/src/denali-canonical-tour-model.ts` (`DenaliDerivedPersistenceView.isMultiDay`) |

**Canonical replacement:** `DenaliCanonicalTourModel.duration` (`single` \| `multi`).

---

### 1.3 `difficultyType` (derived `physical` \| `none`; ghost on program patch)

| Area | Files |
|------|--------|
| **Not in Zod schema** | Stripped by `denaliFormSanitize` (`STRIP_PROGRAM`) |
| **Derived** | `denali/denaliWizardDerived.ts` → `deriveDenaliDifficultyType(tourType)` |
| **API mapping** | Not sent as top-level field; outdoor difficulty → `tripDetails.overview.difficultyLevel` (numeric rating) in `mapDenaliWizardToCreateTourPayload.ts` |
| **Types** | `packages/types/src/denali-canonical-tour-model.ts` (`denaliDifficultyTypeFromCategory`) |

**Canonical MVP:** No `difficultyType` on flat model; outdoor program fields optional in legacy form only.

---

### 1.4 Legacy transport fields

| Field | Role | Dependent files |
|-------|------|-----------------|
| `transport.transportMode` | MVP (`organizer_vehicle` \| `shared_cars` \| `none`) | `DenaliTransportStep.tsx`, `DenaliReviewStep.tsx`, schema, normalize, structural + compiled validation, `mapDenaliWizardToCreateTourPayload.ts`, `denaliRuleModel.ts`, clone/preset mappers |
| `transport.dongAmount` | MVP (shared cars) | Same + conditional UI in transport/review steps |
| `transport.transportNotes` | **Ghost (MVP UI shows, not in rule model)** | `DenaliTransportStep.tsx`, `mapDenaliWizardToCreateTourPayload.ts` → `transportationNotes` |
| API `privateCarMode`, `fuelShareToman`, `transportModes` | **Derived at mapper** from `transportMode` + `dongAmount` | `mapDenaliWizardToCreateTourPayload.ts`, `canonicalToCreateTourPayload.ts` (future) |
| Legacy `privateCarAllowed`, `includesTransportInPrice` | Ghost | `presetDefaultsToDenaliFormPatch.ts`, `denaliFormSanitize.ts` |

**Canonical transport:** `transport.mode` + optional `transport.dongAmount` only.

---

### 1.5 Other legacy form sections (not in flat canonical MVP)

Still on `DenaliCreateTourWizardForm` but absent from `packages/types/src/denali/denaliCanonicalTourModel`:

| Section | Legacy-only fields (examples) |
|---------|-------------------------------|
| `programNature` | `secondaryTourThemeIds`, `difficultyLevel`, `hikingHoursApprox`, `altitudeGainApprox`, `itineraryOutline` |
| `participantRequirements` | `fitnessLevel`, `experienceLevel`, `sportsInsuranceRequired`, gear IDs, `medicalNotes`, `technicalSkillNotes` |
| `policies` | Five textareas → canonical `policies.policiesText` (MVP review uses `cancellationPolicy` only) |
| `pricingPayment` | `paymentMode: "offline_receipt"` (fixed literal in compiler) |

**Rule/UI:** Outdoor + mountain participant paths in `denaliRuleModel.ts` (`submit_only`); `DenaliProgramNatureStep.tsx`, `DenaliReviewParticipantSection.tsx`.

---

### 1.6 Files that import `DenaliCreateTourWizardForm` / `denaliTourCreateSchema` (inventory)

**Runtime (submit path):**

- `components/tours/wizard/DenaliCreateTourWizard.tsx` — `denaliCanonicalWizardResolver` (was `zodResolver(denaliTourCreateSchema)`)
- `domain/createTourFromWizard.ts` — parse + shadow + legacy mapper
- `hooks/useDenaliTourWizardCreate.ts`

**Validation stack:**

- `schemas/denaliTourCreateSchema.ts`, `schemas/denaliTourCreateValidation.ts`
- `denali/validation/denaliRuleValidation.ts`, `denali/validation/denaliCanonicalShadowValidator.ts`
- `denali/rules/denaliZodCompiler.ts`

**Phase 4 (not wired):**

- `schemas/denaliCanonicalTourSchema.ts`
- `domain/canonicalToCreateTourPayload.ts`

**Adapters / data in:**

- `denaliWizardDraftEnvelope.ts`, `tourCreationPresetApply.ts`, `profiles/*`, `presetDefaultsToDenaliFormPatch.ts`, `sources/loadWizardPrefill.ts`, `clone/transformTourToDenaliWizardValues.ts`, `app/(app)/tours/[id]/tour-trip-details-panel.tsx` (if Denali edit)

**Tests / scripts:** `*.spec.ts` under wizard + `tests/integration/real-tenant.helpers.ts`, `scripts/qa-denali-owner-matrix.ts`

---

## 2. What will be deleted (target end state)

| Item | Rationale |
|------|-----------|
| `denaliTourCreateBaseSchema` 6-tab ghost fields | Replaced by strict `denaliCanonicalTourSchema` + generated/permitted fields only |
| `refineDenaliStructuralForm` duplicate of compiler structural refines | Single structural layer on canonical or shared module |
| `withDenaliRuleEngine` / double validation on submit | One pipeline: canonical schema (+ optional rule compiler from same manifest) |
| `basicInfo.tourType` as **stored** form field | Replaced by `category` + `duration` (+ `eventVariant` if product keeps sub-type control) |
| Derived-only ghosts: `isMultiDay`, `difficultyType`, `includesTransportInPrice` | No longer needed on form patches |
| Rule field paths tied to legacy sections only | Regenerated from canonical field manifest |
| `mapDenaliWizardToCreateTourPayload` (legacy) | Replaced by `mapCanonicalToCreateTourPayload` after parity proof |
| Nested `packages/types/src/denali-canonical-tour-model.ts` (optional) | Superseded by `packages/types/src/denali/denaliCanonicalTourModel.ts` once consumers migrate |
| `readDenaliCanonicalBasics` / `patchDenaliCanonicalBasics` slug adapter (UI) | Direct canonical controls |
| Duplicate rule sources | Already removed: `denaliRules.ts`, `denaliRuleEngine.ts`, `useDenaliWizardRules.ts` |

**Keep (API boundary, not form):**

- `overview.denaliTourKind` on API / DB until API schema migration
- `assertDenaliPilotTripDetails` until generated from shared manifest or canonical→API mapper tests

---

## 3. What will be replaced

| Current | Replacement |
|---------|-------------|
| `DenaliCreateTourWizardForm` | `DenaliCanonicalTourModel` as RHF values (or thin wrapper with canonical sections) |
| `denaliTourCreateSchema` submit | `denaliCanonicalTourSchema` (+ rule compiler fed from `denaliRuleSet` keyed by category/duration) |
| `parseDenaliTourCreateForm` | `parseDenaliCanonicalTour` |
| Legacy `tourType` watch hook (removed) | `DenaliCanonicalContext` + `getDenaliUIFromForm` / `getDenaliUIFromCanonical` |
| `resolveDenaliRuleModelFromForm` (slug) | `getDenaliRulesFromCanonical` |
| `denaliCanonicalFromForm` at submit only | Form stores canonical shape; shadow becomes identity check |
| `mapDenaliWizardToCreateTourPayload` | `mapCanonicalToCreateTourPayload` (slug derived once at API boundary) |
| Step validation via legacy paths | `compileDenaliStepSchema` from canonical classification |
| `normalizeDenaliWizardForm` slug/orphan logic | `normalizeDenaliCanonical` from rule model hidden fields |
| Clone/preset mappers | Map to/from canonical, not legacy 6-tab |

---

## 4. Risk areas

| Risk | Severity | Notes |
|------|----------|-------|
| **Dual validation (base + compiled + structural)** | High | Submit runs legacy base + duplicate structural refines today; cutover must collapse to one schema |
| **Shadow vs legacy parse divergence** | Medium | `DENALI_CANONICAL_SHADOW_MODE` may log mismatches until form emits canonical shape |
| **Clone / preset / draft envelopes** | High | Still produce legacy patches; need canonical serializers |
| **API `denaliTourKind` round-trip** | High | Edit/clone read slug from API; canonical uses category/duration until API accepts both |
| **Outdoor / mountain fields** | Medium | In rules + mapper but not in flat canonical; product decision before delete |
| **Event variant** | Medium | Flat canonical has no `eventVariant`; slug encodes `event_reading` \| `event_cinema` today |
| **E2E / integration tests** | Medium | Assert on legacy field paths and kinds |
| **docs/** architecture drift | Low | `denali-wizard-field-mapping.md` describes 6-tab model |
| **Two `DenaliCanonicalTourModel` types** | Medium | `denali-canonical-tour-model.ts` vs `denali/denaliCanonicalTourModel.ts` — rename/merge before wide import |

---

## 5. Safe migration order

Recommended sequence (each step shippable with shadow + tests green):

1. **Unify type exports** — Export flat `DenaliCanonicalTourModel` from `@repo/types` (deprecate or alias nested model). Document field mapping table (canonical ↔ API).

2. **Collapse validation** — Remove `refineDenaliStructuralForm` duplication; extend `denaliRuleModel` / compiler with any missing structural rules; keep legacy submit until step 3.

3. **Align rule manifest with flat canonical** — Add canonical field paths to `denaliRuleSet` (or generate manifest from one JSON source). Wire `getDenaliRulesFromCanonical` in validation path behind flag.

4. **Expand canonical schema** — If product requires outdoor/mountain/event variant on MVP, add to flat model + schema before UI cutover; else keep mapper-only defaults for API.

5. **Adapter layer** — `canonicalToForm` / `formToCanonical` for draft, preset, clone (replace slug writes).

6. **UI cutover (basics)** — Store `category`, `duration`, `eventVariant?` in form; `getDenaliUIFromCanonical` via `DenaliCanonicalContext`; remove `basicInfo.tourType` from RHF.

7. **UI cutover (steps)** — Transport/review use `ui.isVisible` only (remove hardcoded `shared_cars` checks).

8. **Submit cutover** — `createTourFromDenaliWizardForm`: `parseDenaliCanonicalTour` → `mapCanonicalToCreateTourPayload`; feature flag `DENALI_CANONICAL_SUBMIT=true`.

9. **Delete legacy** — Remove ghost schema fields, `denaliTourCreateBaseSchema` dependency, legacy mapper, slug adapter UI helpers.

10. **API manifest (optional)** — Generate `assertDenaliPilotTripDetails` rules from same source as `denaliRuleSet`.

**Gates before step 8:**

- Shadow validator silent for all smoke tour kinds
- Parity test: `mapDenaliWizardToCreateTourPayload(form)` ≈ `mapCanonicalToCreateTourPayload(denaliCanonicalFromForm(form))`
- No remaining production import of `basicInfo.tourType` except API boundary mapper

---

## 6. Phase 4 readiness checklist

| Criterion | Done? |
|-----------|-------|
| Flat canonical model + `denaliCanonicalFromForm` | Yes |
| `getDenaliRulesFromCanonical` / `getDenaliUIFromCanonical` | Yes (not UI-active) |
| `denaliCanonicalTourSchema` | Yes (not submit-active) |
| `canonicalToCreateTourPayload` | Yes (not submit-active) |
| Shadow validation on submit | Yes |
| UI uses canonical form state | No |
| Submit uses canonical schema | No |
| Legacy base schema removed from submit/resolver/wizard | Yes (tests/shadow only) |

---

Phase 4 cutover is safe only after removing base schema dependency
