# Denali Wizard — System Integrity & Enterprise Audit

**Date:** 2026-05-25  
**Scope:** `apps/web/src/features/tours/wizard/denali/` (+ orchestrators that mount the wizard)  
**Registry SSOT:** `denali/registry/denaliFieldRegistryData.ts` (56 `canonicalPath` entries)

## Executive summary

| Area | Verdict | Notes |
|------|---------|-------|
| Dead logic / path leaks | **Mostly clean** | All wizard **step** visibility uses `useDenaliStepFieldRules`. A few path/focus mismatches and one orphan helper remain. |
| Coupling (`denaliUIAdapter` / `validation/`) | **Not clean** | No `.tsx` imports `denaliUIAdapter` (good). Three **UI surfaces** import `validation/` directly (should be orchestrator-only). |
| SSOT (`tourType` / `category` / `transportMode` in components) | **Clean in steps** | No category/tourType/transportMode branching in Denali step `.tsx` files. Shadow logic lives in adapters/validation (expected) plus one dead file. |
| Export hygiene (`denali/index.ts`) | **Bloated barrel** | Barrel is only consumed for **step components**; ~45 re-exports are never imported via the barrel path. |

**Overall:** The wizard **step layer is registry-driven** through `useDenaliStepFieldRules` → `denaliUIAdapter` → generated rule set. The system is **not yet enterprise-sealed**: validation leaks into step UI, the public barrel is overweight, and one legacy altitude helper is orphaned.

---

## 1. Dead logic hunt (canonical path strings in `.tsx`)

### Method

- Collected all 56 `canonicalPath` values from `denaliFieldRegistryData.ts`.
- Scanned Denali + tour component `.tsx` for quoted path literals.
- Classified: **OK** if routed through `useDenaliStepFieldRules` (or registry helpers); **leak** if used for visibility/rules outside that pipeline.

### Step layer — registry-driven (OK)

Every Denali **step** uses `useDenaliStepFieldRules` with canonical path literals passed to `isVisible` / `isRequired` / `arePathsVisible`:

| File | Paths via hook |
|------|----------------|
| `steps/DenaliBasicInfoStep.tsx` | `eventVariant`, `destinationId`, `leaderUserIds`, `requiresLocalGuide`, `localGuideName`, `endDateTime`, `capacityMax`, `capacityMin`, `socialMediaLink` |
| `steps/DenaliProgramNatureStep.tsx` | `program.difficultyLevel`, `program.hikingHoursApprox`, `program.altitudeMeasurement`, `program.itinerary` |
| `steps/DenaliLogisticsStep.tsx` | `participants.gearItems`, `gatheringPoints`, `startPoint`, `summitPoint`, `campPoint`, `endPoint`, `transport.*` |
| `steps/DenaliPricingPaymentStep.tsx` | `pricing.basePricePerPerson` |
| `steps/DenaliPricingParticipantSection.tsx` | `participants.minimumAge`, `maximumAge`, `fitnessLevel`, `nationalIdRequired`, `sportsInsuranceRequired`, `policies.policiesText` |
| `steps/DenaliPhotosStep.tsx` | `photos` |
| `steps/DenaliReviewStep.tsx` | review-step visibility via hook |
| `steps/DenaliReviewParticipantsDisplay.tsx` | participant review fields |

Path strings are **duplicated** in TSX (not codegen’d from registry). That is acceptable technical debt, not a rules leak, as long as they stay in sync with registry (enforced by `audit:denali-registry` / codegen gates).

### Findings — leaks / drift

| Severity | Location | Issue |
|----------|----------|-------|
| **Medium** | `steps/DenaliLogisticsStep.tsx` | `data-field-path="transport.transportMode"` — registry canonical path is **`transport.mode`**. Focus/validation mapping may miss this control. |
| **Low** | `DenaliDatetimeField.tsx` | Props `startDateTime` / `endDateTime` match canonical paths but are wired manually to RHF (`basicInfo.startDateTime`). Infrastructure, not visibility logic. |
| **Low** | `denaliAltitudeVisibility.ts` | `category === "mountain"` — **orphan** shadow logic; only referenced by its spec. Altitude visibility is driven by registry rules + `isVisible("program.altitudeMeasurement")` in `DenaliProgramNatureStep`. **Safe to delete** after confirming no external imports. |
| **Info** | `components/tour-create-trip-details-fields.tsx` | Reuses `DenaliGatheringPointsWidget` on the **classic** trip-details form (parallel surface, not Denali wizard SSOT). |

### False positives (not leaks)

- `TourCard.tsx` / `TourForm.tsx` matching substring `"title"` — unrelated UI copy, not Denali canonical paths.
- `TourEditDenaliGeoSection.tsx` — geo edit section; uses Denali location widgets, not rule paths for visibility.

---

## 2. Coupling audit (`denaliUIAdapter` / `denali/validation/`)

### `denali/rules/denaliUIAdapter.ts` in `.tsx`

**None.** All UI adapter usage stays in hooks, rules, validation, and specs. Step components reach it only through `useDenaliStepFieldRules`.

### `denali/validation/` in component files

Allowed pattern: **wizard orchestrators** import validation for submit, draft hydrate, and invariant application.

| File | Role | Imports | Verdict |
|------|------|---------|---------|
| `components/tours/wizard/DenaliCreateTourWizard.tsx` | Create orchestrator | `denaliInvariantEngine`, `denaliRuleAccess`, `denaliWizardPublishReadiness` | **Allowed** |
| `components/tours/DenaliTourEditForm.tsx` | Edit orchestrator | `denaliRuleAccess` | **Allowed** |
| `app/(app)/tours/[id]/edit/tour-edit-client.tsx` | Page shell | `resolveDenaliRuleSetFromTemplate` | **Borderline OK** (app entry, not a field step) |

### Coupling violations (cleanup list)

| File | Imports | Recommendation |
|------|---------|----------------|
| `denali/components/DenaliReviewValidationSummary.tsx` | `getDenaliWizardVisibleSteps` from `validation/denaliRuleAccess` | Move behind a hook (`useDenaliReviewValidationSummary`) or pass `visibleSteps` from orchestrator/review parent. |
| `denali/steps/DenaliReviewStep.tsx` | `getDenaliWizardSubmitIssues`, `getDenaliWizardPublishReadinessIssues` | Lift to orchestrator or `useDenaliPublishReadiness`-style hook; keep step presentational. |

No other Denali **step** or **denali/components** `.tsx` files import `validation/` or `denaliUIAdapter` directly.

---

## 3. SSOT verification (`tourType` / `category` / `transportMode` branching)

### Denali wizard `.tsx` (steps + denali components)

**No `if (category …)`, `if (tourType …)`, or `if (transportMode …)` shadow branches** found in step or denali component files.

Display-only logic (not SSOT violations):

- `DenaliReviewParticipantsDisplay.tsx` — maps `fitnessLevel` enum to labels for review copy.
- `DenaliReviewStep.tsx` — `publishStatus === "active"` gating (lifecycle, not tour category).
- `DenaliBasicInfoStep.tsx` — crew **role** labels (`owner` / `admin` / `leader`).

### Shadow logic outside components (necessary or legacy)

These files branch on `category` / `tourType` / `transportMode` and belong to the **rules/adapter/schema** layer, not UI steps:

| File | Purpose |
|------|---------|
| `denaliCanonicalBasicsControl.ts` | Event variant required when `category` is event |
| `denaliWizardDerived.ts` | Tour-type → multi-day / variant derivations |
| `denaliThemeFilter.ts` | Theme list filtered by `category` |
| `denaliItinerarySync.ts` | Itinerary day count from `tourType` |
| `canonicalTemplateHydration.ts` | Template merge preserves `eventVariant` when `category === "event"` |
| `validation/denaliInvariantEngine.ts` | Structural invariants keyed by `category` |
| `validation/denaliRuleAccess.ts` | Rail/testing overrides for `category === "event"` |
| `transport/patchDenaliTransportForMode.ts` | Mode change clears incompatible transport fields (uses `@repo/types` helpers, not raw string compares in UI) |
| `schemas/denaliCanonicalTourSchema.unified.ts` | `category === "mountain"` in `superRefine` |
| `domain/buildDenaliCreateTourPayloadProjection.ts` | API payload projection (`category`, `mode === "train"`) |
| `presetDefaultsToDenaliFormPatch.ts` | Preset → form patch mapping |

### Dead / duplicate shadow logic

| File | Issue |
|------|-------|
| `denaliAltitudeVisibility.ts` | Duplicates registry rule for altitude (`category === "mountain"`); **unused** by runtime UI |

### Unrelated app components

- `components/registrations/registration-transport-crm-cell.tsx` — registration CRM, not Denali wizard.

---

## 4. Export hygiene (`denali/index.ts`)

### Barrel consumers

Only **two** files import from `@/features/tours/wizard/denali`:

- `DenaliCreateTourWizard.tsx` — step components only
- `DenaliTourEditForm.tsx` — step components only (photos step uses deep import)

Everything else uses **deep paths** (`denali/DenaliCanonicalContext`, `denali/validation/...`, etc.).

### Barrel exports vs usage

| Export group | Used via barrel? | Used via deep import? |
|--------------|------------------|------------------------|
| Step components (`Denali*Step`) | **Yes** | Also deep (`DenaliPhotosStep` in edit form) |
| `DenaliCanonicalProvider`, hooks, draft helpers | No | Yes |
| `denaliRuleSet`, `isVisible`, `isRequired`, `isDenaliDurationAllowed` | No | Yes (`rules/`, `hooks/`) |
| `DENALI_TEMPLATE_SCHEMA`, `deriveDenaliTemplateSchema`, … | No | Yes (`rules/`) |
| Draft/storage exports (`tryHydrateDraft`, `resolveDenaliWizardDraftHydration`, …) | No | Yes |

**Conclusion:** No evidence of **dead symbols** (zero references repo-wide). The issue is **barrel bloat**: ~45 re-exports are **never imported through the barrel**, which obscures the real public API and suggests copy-paste growth.

### Recommended barrel shape

```ts
// Public wizard surface (minimal)
export { DenaliBasicInfoStep, DenaliProgramNatureStep, DenaliLogisticsStep,
         DenaliPricingPaymentStep, DenaliPhotosStep, DenaliReviewStep } from "./steps/...";
export { DenaliCanonicalProvider, useDenaliCanonical } from "./DenaliCanonicalContext";
// Optional: hooks consumed by app shells
export { useDenaliStepFieldRules } from "./hooks/useDenaliStepFieldRules";
```

Move template schema / draft / rule re-exports to explicit deep imports or a `denali/server.ts` / `denali/draft.ts` entry if needed.

---

## 5. Next cleanup list (priority order)

1. **Fix focus path drift** — `transport.transportMode` → `transport.mode` in `DenaliLogisticsStep.tsx` (`data-field-path` / focus bridge).
2. **Decouple review UI from validation** — `DenaliReviewValidationSummary.tsx`, `DenaliReviewStep.tsx` (hooks or orchestrator props).
3. **Remove orphan** — `denaliAltitudeVisibility.ts` (+ spec) after confirming zero imports.
4. **Slim `denali/index.ts`** — export only steps + provider (+ documented secondary entry points).
5. **Optional** — codegen canonical path constants from registry for step `isVisible("…")` literals to eliminate string drift.

---

## 6. Enterprise readiness scorecard

| Criterion | Status |
|-----------|--------|
| Field visibility driven by registry rule set | **Pass** (via `useDenaliStepFieldRules`) |
| No `denaliUIAdapter` in presentational `.tsx` | **Pass** |
| No `validation/` in presentational `.tsx` | **Fail** (2 review surfaces) |
| No category/tourType/transportMode UI branching in steps | **Pass** |
| Single public barrel contract | **Fail** (bloated, unused re-exports) |
| No orphan shadow helpers | **Fail** (`denaliAltitudeVisibility.ts`) |

**When the two coupling violations, focus-path drift, and barrel/orphan cleanup are done, the Denali wizard qualifies as enterprise-grade (registry-driven, orchestrator-owned validation, thin steps).**
