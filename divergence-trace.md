# Architectural Deviations — Tour Create Wizard

Generated: 2026-05-25. Scope: profile/wizardMode branching in `apps/web/src/components/tours/wizard/`, plus smoke/mock data that diverges from the Denali field registry and `TOUR_WORKSPACE_DEFINITIONS` (`packages/shared-contracts`).

**Registry authority (production):**

- Workspace rail: `getTourWorkspaceDefinition(profile).ui.wizardMode` → `"denali"` only for `denali_pilot` and `urban_event`.
- Denali fields: `apps/web/src/features/tours/wizard/denali/registry/denaliFieldRegistryData.ts` (+ codegen).

---

## 1. Profile / `wizardMode` conditional rendering

These are the only places under `components/tours/wizard/` that choose **different wizard shells** from profile (via `isDenaliPilotFormProfile` → `getTourWorkspaceDefinition` → `ui.wizardMode`, not a raw `wizardMode` string in components).

| ID | File | Lines (approx.) | Logic | Deviation |
|----|------|-----------------|-------|-----------|
| **D-01** | `TourCreateWizard.tsx` | 112–118 | `if (isDenaliPilotFormProfile(profile)) return <DenaliCreateTourWizard />` else `<ClassicTourCreateWizardRoot />` | **Intentional orchestrator fork** — two rails (Denali 6-tab vs classic 9-step). Not driven by registry field rows; driven by workspace definition. |
| **D-02** | `TourCreateWizard.tsx` | 85–109 | `if (profileValidationError)` → data-legacy alert UI | Profile/template guard UI; blocks both rails. |
| **D-03** | `legacy/ClassicTourCreateWizard.tsx` | 433–435 | `if (meta?.resolvedFormProfile && meta.resolvedFormProfile !== "general")` when picking draft meta for UI | **Hardcoded `general` preference** — draft meta resolution favors any non-`general` profile over `general`, independent of workspace template authority. |
| **D-04** | `legacy/ClassicTourCreateWizard.tsx` | 1127 | `useRef<TourFormProfile>("general")` in `ClassicTourCreateWizardRoot` | **Fallback profile is `general`** until template loads; Zod resolver uses `profileSchemaRef.current` (can validate against wrong profile on first paint). |
| **D-05** | `legacy/ClassicTourCreateWizard.tsx` | 486–499, 581–590 | `workspaceFormProfile ?? profileSchemaRef.current`; `visibleSteps` from `wizardStepEngine.getVisibleStepsForRuntime(resolvedProfile, …)` | Profile drives **which classic steps exist**, not which React component type — still classic shell only. |
| **D-06** | `legacy/schemas/tourCreateValidationPolicy.ts` | 81–87 | `tourFormProfileToWizardValidationFlags(profile)` via `getStepRule(profile, …)` | Profile → Zod relaxation flags (itinerary/logistics). No alternate component tree. |
| **D-07** | `legacy/schemas/tourCreateSchema.ts` | 498 | `tourCreateSchema = buildTourCreateSchemaForFormProfile("general")` | Default export frozen to **`general`** schema, not workspace-resolved profile. |

**Not profile-based (step rail only, same Denali shell):**

| ID | File | Lines (approx.) | Logic | Note |
|----|------|-----------------|-------|------|
| **D-08** | `DenaliCreateTourWizard.tsx` | 155–178 | `switch (stepId)` → `DenaliBasicInfoStep`, `DenaliProgramNatureStep`, … | Step id → step component; visibility of steps comes from rule engine + `getDenaliWizardVisibleSteps`, not from `if (profile)`. |
| **D-09** | `legacy/ClassicTourCreateWizard.tsx` | 1091–1099 | `currentStepKey === "basic" && <BasicInfoStep />`, … | Classic step → step component chain. |

**Related (environment, not production profile):**

| ID | File | Lines (approx.) | Logic | Note |
|----|------|-----------------|-------|------|
| **D-10** | `legacy/ClassicTourCreateWizard.tsx` | 105–134, 844–854 | `e2eWizardSeedEnabled()` / `?e2eTourType=` / `__E2E_SEED_TOUR_TYPE` | Loopback E2E seeds `overview.tourType` before template profile applies. |
| **D-11** | `DenaliCreateTourWizard.tsx` | 258–261 | `withDenaliWizardRailTestingOverrides(rawSteps)` | **Dev-only:** `NODE_ENV === "development"` can force `denali_logistics` / `denali_photos` back onto the rail (`denali/validation/denaliRuleAccess.ts`). |

**Re-exports only (no branching in components):**

- `legacy/schemas/tourCreateSchema.ts` — re-exports `isDenaliWizardContext`, `isDenaliWizardMode`, `TourWizardMode` from `@/features/tours/wizard/isDenaliWizardContext` (no local `if`).

---

## 2. Hardcoded mock / smoke data conflicting with production registry

### 2.1 Under `components/tours/wizard/`

| ID | File | Conflict |
|----|------|----------|
| **M-01** | `legacy/schemas/tourCreateSchema.spec.ts` | Repeated fixture UUID `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` as `mainDestinationId` / `location.mainDestinationId`. **Classic** shape (`overview.*`, `location.*`), not Denali registry paths (`basicInfo.destinationId`). Comment claims “Playwright smoke parity” with relaxed flags, not registry codegen. |
| **M-02** | `legacy/schemas/tourCreateSchema.spec.ts` | `buildTourCreateSchemaForFormProfile("general")` + `setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: true })` — validates **general** with urban/cinema-style relax flags; diverges from strict `general` descriptor + workspace template authority. |
| **M-03** | `legacy/schemas/tourCreateSchema.ts` | Default schema profile **`general`** while production create path resolves profile from `workspace_tour_wizard_templates.baseProfile` (D-07). |

### 2.2 Smoke helpers and Playwright specs (cross-cutting)

| ID | File | Conflict |
|----|------|----------|
| **M-04** | `apps/web/tests/smoke/tour-wizard-smoke-helpers.ts` | `buildSmokeWizardTemplateEnvelope()` uses fixed template id `11111111-1111-4111-8111-111111111111` and arbitrary `baseProfile` strings (`TourWizardSmokeTemplateProfile`). **`mountain_outdoor`, `cinema_event`, `cultural_tour`, `general` are not in `TOUR_WORKSPACE_DEFINITIONS`** — smoke exercises classic `profileRules`, not Denali registry rails. |
| **M-05** | `apps/web/tests/smoke/tour-wizard-smoke-helpers.ts` | `SMOKE_DEFAULT_WORKSPACE_TEMPLATE_PROFILE = "urban_event"` vs `10-denali-wizard-shell.spec.ts` mocking **`denali_pilot`**. Both map to Denali workspace in registry, but tests disagree on which profile label is “the” Denali smoke default. |
| **M-06** | `apps/web/tests/smoke/tour-wizard-smoke-helpers.ts` | `fillTourWizardBasicInfoStep()` fills `overview.title`, `overview.shortDescription`, `overview.longDescription` — **classic RHF paths only**; Denali registry uses `basicInfo.title` / `programNature.shortDescription`. |
| **M-07** | `apps/web/tests/smoke/10-denali-wizard-shell.spec.ts` | Asserts `data-wizard-step-count="5"` while `denaliStepConfig.ts` defines **6** rail ids (`denali_basic` … `review`). Count may match rule-hidden steps in some hosts but contradicts registry/config comment (“5-step rail”) and structural `denali_photos` step. |
| **M-08** | `apps/web/tests/smoke/12-denali-verification-matrix.spec.ts` | Uses `getByTestId("denali-tour-category-event")` — **stale test id**. Production control is `data-testid="denali-basics-category"` (`DenaliBasicInfoStep.tsx`). Test does not match registry-driven UI. |
| **M-09** | `apps/web/tests/smoke/05-tour-wizard-preset-form-profile-filter.spec.ts` | Mocks workspace `cinema_event` + preset with `formProfile: "general"` — valid for classic preset filtering, **not** Denali registry / workspace definition entries. |
| **M-10** | `apps/web/tests/smoke/06-tour-wizard-clone-query.spec.ts` | Theme row `formProfile: "general"` while asserting Denali wizard + `urban_event` in draft meta — mixed profile mocks vs registry. |
| **M-11** | `apps/web/tests/smoke/08-tour-wizard-mix-profile-flip.spec.ts` | `workspaceTemplateProfile: "mountain_outdoor"` — **not** in `TOUR_WORKSPACE_DEFINITIONS`; forces **classic** rail while theme rows carry `urban_event` / `mountain_outdoor` / `cinema_event`. |
| **M-12** | `apps/web/tests/smoke/11-denali-review-participants.spec.ts` | Assumes live host shows Denali with default **mountain_day** behavior; no `installTourWizardSettingsRoutes` — profile comes from real DB/API, not registry fixtures. |
| **M-13** | `apps/web/tests/smoke/data-integrity.spec.ts` | **Aligned with production** — uses `StrictProfileValidator` / `isDenaliStructuredTemplate`; flags `baseProfile: general` on Denali-shaped templates (opposite of M-09/M-10 patterns). Listed as contrast, not a deviation. |

### 2.3 Production schema exports used as test UUIDs (wizard feature layer)

| ID | File | Conflict |
|----|------|----------|
| **M-14** | `apps/web/src/features/tours/wizard/schemas/denaliTourCreateBaseSchema.ts` | `DENALI_WIZARD_TEST_DESTINATION_ID` / `DENALI_WIZARD_TEST_THEME_ID` (`a0eebc99-…`, `b1eebc99-…`) in **production package path**; used by `buildDenaliTourCreateTestValues()` and many `*.spec.ts` files. Registry expects real catalog UUIDs; tests reuse stable fake IDs that are not workspace catalog rows. |
| **M-15** | Multiple `apps/web/src/features/tours/wizard/**/*.spec.ts` | Same `a0eebc99` / `b1eebc99` UUIDs (e.g. `mapDenaliWizardToCreateTourPayload.spec.ts`, `denaliFormSanitize.spec.ts`) — parallel mock catalog **outside** `components/tours/wizard` but same fragmentation family as M-01/M-14. |

---

## 3. Summary matrix

| Category | Count | Severity |
|----------|-------|----------|
| Profile/wizardMode component forks (D-01–D-07) | 7 | D-01 expected; D-03/D-04/D-07 are legacy fallbacks |
| Step-only switches (D-08–D-09) | 2 | Normal pattern |
| E2E / dev overrides (D-10–D-11) | 2 | Non-production |
| Mock/smoke registry conflicts (M-01–M-15) | 15 | M-08/M-07/M-06 highest practical risk |

---

## 4. Recommended alignment (reference)

1. **Single profile authority** — Remove `profileSchemaRef` default `"general"` (D-04) and `tourCreateSchema` default (D-07); always block render until `useTenantWizardTemplate` resolves (same as Denali path).
2. **Smoke template profiles** — Restrict `TourWizardSmokeTemplateProfile` to keys present in `TOUR_WORKSPACE_DEFINITIONS` + explicit classic-only profiles, or document two smoke suites (classic vs Denali).
3. **Denali smoke selectors** — Fix M-08 (`denali-basics-category`); align M-07 step count with `denaliWizardSteps.length` or documented visible-step rules.
4. **Test UUIDs** — Move `DENALI_WIZARD_TEST_*` to `*.spec.ts` / `__fixtures__` only (M-14); stop exporting from schema entry used by runtime defaults.
5. **Helpers** — Add `fillDenaliWizardBasicInfoStep()` using `basicInfo.*` / registry test ids (M-06).

---

## 5. File path index (quick lookup)

**Components — profile / mode**

- `apps/web/src/components/tours/wizard/TourCreateWizard.tsx`
- `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx`
- `apps/web/src/components/tours/wizard/legacy/ClassicTourCreateWizard.tsx`
- `apps/web/src/components/tours/wizard/legacy/schemas/tourCreateSchema.ts`
- `apps/web/src/components/tours/wizard/legacy/schemas/tourCreateValidationPolicy.ts`

**Components — specs / mocks**

- `apps/web/src/components/tours/wizard/legacy/schemas/tourCreateSchema.spec.ts`

**Smoke**

- `apps/web/tests/smoke/tour-wizard-smoke-helpers.ts`
- `apps/web/tests/smoke/05-tour-wizard-preset-form-profile-filter.spec.ts`
- `apps/web/tests/smoke/06-tour-wizard-clone-query.spec.ts`
- `apps/web/tests/smoke/08-tour-wizard-mix-profile-flip.spec.ts`
- `apps/web/tests/smoke/10-denali-wizard-shell.spec.ts`
- `apps/web/tests/smoke/11-denali-review-participants.spec.ts`
- `apps/web/tests/smoke/12-denali-verification-matrix.spec.ts`
- `apps/web/tests/smoke/data-integrity.spec.ts` (aligned guard)

**Registry / workspace (authority)**

- `packages/shared-contracts/src/tours/workspace-registry.ts`
- `apps/web/src/features/tours/wizard/denali/registry/denaliFieldRegistryData.ts`
- `apps/web/src/features/tours/wizard/isDenaliWizardContext.ts`
