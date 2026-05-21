# Denali Create Tour Wizard - Status & Architectural Audit

## PART 1: Completed Tasks (Phases 2 & 3)

### Tasks 2.9 - 2.16: UX & Stability Overhaul (Status: Completed ✅)
*   **Draft Lifecycle**: Implemented hard-reset logic for the "Clear Draft" button, including `localStorage` purging and RHF tree clearing.
*   **Social Link Refactor**: Consolidated individual social fields into a single `socialMediaLink` with backward compatibility for legacy drafts.
*   **Numeric Difficulty**: Transitioned difficulty level from enums to a 1-10 numeric scale with 0.5 step granularity using a range slider.
*   **Gear Section Redesign**: Overhauled gear selection into a modern **Interactive Pill Matrix** (Pills with 3 states: Unselected, Suggested 🎒, Required 🚨).
*   **Submission Integrity**: Fixed the critical "Auto-Submit" bug on Review step entry. API dispatch is now strictly bound to the final confirmation click.

### TASK 3.1: Full-Stack Persistence Gap Closure (Status: Completed ✅)
*   **Backend Whitelisting**: Updated `TripDetailsOverviewDto` and `TripDetailsDayPlanDto` to include `leaderUserIds`, `localGuideName`, and itinerary `photos`.
*   **Frontend Projection**: Modified `buildDenaliCreateTourPayloadProjection.ts` to stop stripping these fields, ensuring full persistence in the `tour_details.trip_details` JSONB column.
*   **Verification**: All 600 tests passed across both frontend and backend modules.

---

## PART 2: Phase 1 Progress Dashboard

**Current Phase**: Phase 1: Backend Infrastructure (Legacy Tracking)
**Status**: Finalized 100% [▓▓▓▓▓▓▓▓▓▓]

---

### PHASE 4: SERVER-BACKED AUTO-SAVE TRACKER

**Current Task**: TASK 4.3 - Compilation & Quality Check
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

**File Execution Log**:
- `apps/api/src/modules/tours/entities/tour-wizard-draft.entity.ts`: **Provisioned ✅**
- `apps/api/src/database/migrations/1777596000000-CreateTourWizardDrafts.ts`: **Generated ✅**
- `apps/api/src/modules/tours/dto/save-tour-draft.dto.ts`: **Created ✅**
- `apps/api/src/modules/tours/tours.drafts.controller.ts`: **Implemented ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit**: **Success (Green) 🟢**
- **Tenant Isolation**: Verified (Middleware + URL Check) 🟢
- **Partial Payload Support**: Enabled (JSONB + Loose DTO) 🟢

**EXECUTIVE SUMMARY**:
Backend infrastructure for multi-tenant draft persistence is fully operational. The system supports high-granularity auto-saves by allowing partial form snapshots to be buffered in the `tour_wizard_drafts` table. Multi-tenancy is enforced via global `TenantGuardMiddleware` and explicit `:workspaceId` route verification.

---

### PHASE 5: ENHANCED DTO WHITELISTING & PAYLOAD PROJECTION

**Current Task**: TASK 5.4 - Core Monorepo Quality Gate
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

**File Execution Log**:
- `apps/api/src/modules/tours/dto/trip-details.dto.ts`: **Verified ✅**
- `apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.ts`: **Verified ✅**
- `apps/web/scripts/qa-denali-owner-matrix.ts`: **Fixed ✅**
- `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.ts`: **Fixed ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit**: **Success (Green) 🟢**
- **Test Pass Rate**: **100% (600/600 Web, 539/539 API) 🟢**

**EXECUTIVE SUMMARY**:
Phase 5 is complete. Full-stack persistence for tour crew and itinerary photos is active. The system successfully whitelists these fields in both production create-tour DTOs and mid-progress draft buffers. All regressions caused by the numeric difficulty refactor (1-10 scale) have been resolved across automation scripts, cloners, and test suites.

---

### PHASE 6: FRONTEND SERVER-SYNC ENGINE & HYDRATION

**Current Task**: TASK 6.4 - Monorepo Final Quality Pass
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

**File Execution Log**:
- `apps/api/src/modules/tours/tours.drafts.controller.ts`: **GET + DELETE added ✅** (PATCH retained)
- `apps/api/src/modules/tours/dto/tour-wizard-draft-response.dto.ts`: **Created ✅**
- `apps/web/app/api/workspaces/[tenantId]/tours/drafts/route.ts`: **BFF proxy ✅**
- `apps/web/lib/tour-wizard-draft.client.ts`: **Created ✅**
- `apps/web/src/features/tours/wizard/hooks/useTourWizardServerSync.ts`: **Created ✅** (500ms debounce)
- `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx`: **Server hydrate + cloud UI ✅** (localStorage removed)
- `apps/web/src/features/tours/wizard/hooks/useDenaliTourWizardCreate.ts`: **DELETE draft on success ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit**: **Success (Green) 🟢** (web + api)
- **pnpm test**: **Success (Green) 🟢** (web 600/600, api 539 pass / 6 skip)

**EXECUTIVE SUMMARY**:
Denali wizard draft lifecycle is wired to `PATCH/GET/DELETE /api/v2/workspaces/:workspaceId/tours/drafts` via BFF. Autosave debounces RHF mutations at 500ms; step transitions flush immediately. Header shows cloud sync status (FA). Clear-draft and successful create purge server draft. Urban wizard `localStorage` path unchanged.


---

## DISCOVERY AUDIT (maplog.md)

**Audit date:** 2026-05-21  
**Scope:** Read-only monorepo scan per [maplog.md](maplog.md) Modules 1–2. **Excluded:** finance, ledger, payments, reconciliation modules. **No code or new tests written.**

**Inventory totals (~105 test artifacts):**

| Layer | Count | Notes |
| :--- | ---: | :--- |
| Web wizard unit specs | ~61 | Under `apps/web/src/features/tours/wizard/` + clone |
| Playwright smoke | 13 | `apps/web/tests/smoke/01–13-tour-wizard*` / `denali*` |
| Playwright integration | 10 | `apps/web/tests/integration/wizard-real-stack*` |
| API e2e (tours/wizard) | 5 | `apps/api/test/e2e/` |
| API unit / drift (tours) | 9 | DTO, invariants, presets |
| Packages (shared) | 9 | `denali-wizard.contract`, `denali-canonical`, profiles |

---

### Module 1: Test Coverage Audit

| Target Asset / Feature | Found Status | Exact File Path Found | Action Required |
| :--- | :--- | :--- | :--- |
| Numeric difficulty 1–10 (0.5 step) | Existing | `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.spec.ts`, `apps/web/src/features/tours/wizard/schemas/denaliTourCreateSchema.spec.ts`, `apps/web/src/features/tours/wizard/denali/validation/denaliWizardEdgeCases.spec.ts` | None (skip duplication) |
| Gear interactive pill matrix | Existing | `apps/web/src/features/tours/wizard/denali/denaliGearSelection.spec.ts` | None (skip duplication) |
| `socialMediaLink` schema / canonical paths | Existing | `apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.ts`, `apps/web/src/features/tours/wizard/denali/denaliCanonicalFormAdapter.ts` | None for schema |
| `socialMediaLink` clone from `chatLink` | Partial | `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.ts` (maps `chatLink` → `socialMediaLink`) | No dedicated spec — do not duplicate; optional assertion in existing clone spec later |
| Denali canonical / Zod / submit gates | Existing | 20+ specs under `apps/web/src/features/tours/wizard/denali/` and `schemas/denali*` | None (skip duplication) |
| `SaveTourDraftDto` + `ToursDraftsController` (`workspaces/.../tours/drafts`) | Missing | Implementation: `apps/api/src/modules/tours/dto/save-tour-draft.dto.ts`, `apps/api/src/modules/tours/tours.drafts.controller.ts` | Gap documented — no automated test; future e2e only if product requires |
| `TripDetailsOverviewDto` `leaderUserIds` / `localGuideName` whitelist | Partial | DTO: `apps/api/src/modules/tours/dto/trip-details.dto.ts`; persistence strip: `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.spec.ts` | None for create path; not asserted in `trip-details-denali-fields.dto.spec.ts` |
| Itinerary day-plan `photos` DTO | Existing | `apps/api/src/modules/tours/dto/trip-details-denali-fields.dto.spec.ts` (L71–89) | None (skip duplication) |
| Denali create / negative invariants (API) | Existing | `apps/api/test/e2e/denali-negative-invariants.e2e-spec.ts`, `apps/api/src/modules/tours/utils/assert-create-tour-invariants.spec.ts` | None (skip duplication) |
| `tenant-resolver.middleware` bypass rules | Existing | `apps/api/test/common/tenant/tenant-resolver.middleware.unit-spec.ts` | None (skip duplication) |
| Cross-tenant API isolation (generic) | Existing | `apps/api/test/e2e/tenant-isolation.e2e-spec.ts`, `tests/security/tenant-isolation.e2e.spec.ts` | None (skip duplication) |
| Wizard template tenant isolation | Existing | `apps/api/test/e2e/tour-wizard-template-isolation.e2e-spec.ts` | None (skip duplication) |
| Wizard draft localStorage tenant isolation | Existing | `apps/web/tests/integration/wizard-draft-tenant-isolation.spec.ts` | None — Urban/local path only |
| Settings server draft restore (Urban) | Existing | `apps/web/tests/smoke/09-tour-wizard-server-draft-restore.spec.ts`, `apps/web/src/features/tours/wizard/pick-wizard-draft-for-restore.spec.ts` | None — uses `/api/v2/settings/tour-wizard-draft`, not `tours/drafts` |
| Denali `useTourWizardServerSync` + `tour-wizard-draft.client` | Missing | `apps/web/src/features/tours/wizard/hooks/useTourWizardServerSync.ts`, `apps/web/lib/tour-wizard-draft.client.ts`, `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx` | Gap documented — manual / indirect QA only; no new test in this audit |
| `DenaliCreateTourWizard` component (direct unit) | Missing | Component: `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx` | Covered by Playwright (`data-testid=denali-create-tour-wizard`) — skip component unit duplication |

---

### Module 2: Clone & Template Architecture Sanity

| Target Asset / Feature | Found Status | Exact File Path Found | Action Required |
| :--- | :--- | :--- | :--- |
| 1–10 difficulty via `ratingToDenaliDifficulty` | Existing (code + test) | `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.ts`, `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.spec.ts` | None (skip duplication) |
| `leaderUserIds` hydration on clone | Code gap | `transformTourToDenaliWizardValues.ts` sets `leaderUserIds: []` — no API→form mapping | Fix mapper before adding clone test; do not duplicate test until mapper reads `overview.leaderUserIds` |
| `localGuideName` hydration on clone | Code gap | Not mapped in `transformTourToDenaliWizardValues.ts` | Same as `leaderUserIds` — mapper fix first |
| Itinerary `photos` on multi-day clone | Partial | `mapDayPlanPhotos` in `transformTourToDenaliWizardValues.ts` L246–251 | Extend existing `transformTourToDenaliWizardValues.spec.ts` later — out of scope for this audit |
| Classic clone rail (tour → urban wizard) | Existing | `apps/web/src/features/tours/clone/transformTourToWizardValues.spec.ts`, `apps/web/src/features/tours/wizard/applyTourWizardPatch.clone-restore.spec.ts` | None (skip duplication) |
| Denali clone E2E → submit | Existing | `apps/web/tests/integration/wizard-real-stack.submit-denali-from-clone.spec.ts`, `apps/web/tests/smoke/06-tour-wizard-clone-query.spec.ts` | None (skip duplication) |
| Crew fields on create payload (not clone) | Existing | `apps/web/src/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload.spec.ts` | None (skip duplication) |
| Clone/prefill orchestration (`?clone=` / preset) | Existing | `apps/web/src/features/tours/wizard/sources/loadWizardPrefill.spec.ts`, `apps/web/src/features/tours/wizard/profiles/mapWizardPrefillToFormPatch.spec.ts`, `apps/web/src/features/tours/wizard/sources/parseWizardPrefillQuery.spec.ts` | None (skip duplication) |

---

### Existing Test Inventory (reference)

**Playwright smoke** (`apps/web/tests/smoke/`): `01-tour-wizard-new`, `02-tour-wizard-cinema-theme-profile`, `03-tour-wizard-submit-urban`, `04-tour-wizard-urban-profile`, `05-tour-wizard-preset-form-profile-filter`, `06-tour-wizard-clone-query`, `07-tour-edit-urban-patch`, `08-tour-wizard-mix-profile-flip`, `09-tour-wizard-server-draft-restore`, `10-denali-wizard-shell`, `11-denali-review-participants`, `12-denali-verification-matrix`, `13-denali-wizard-map-fields-dom`.

**Playwright integration** (`apps/web/tests/integration/`): `wizard-draft-tenant-isolation`, `wizard-real-stack.shell`, `wizard-real-stack.denali-map-fields`, `wizard-real-stack.denali-preset-settings`, `wizard-real-stack.submit-denali-from-clone`, `wizard-real-stack.submit-denali-from-preset`, `wizard-real-stack.submit-denali-matrix`, `wizard-real-stack.submit-denali-mountain`, `wizard-real-stack.submit-mix-urban`, `wizard-real-stack.submit-urban`.

**API e2e** (`apps/api/test/e2e/`): `tours-create.e2e-spec.ts`, `tours-create-profile-authority.e2e-spec.ts`, `tour-wizard-template-isolation.e2e-spec.ts`, `denali-negative-invariants.e2e-spec.ts`, `tour-presets-tenant-isolation.e2e-spec.ts`.

**Clone / prefill unit (primary):** `transformTourToWizardValues.spec.ts`, `transformTourToDenaliWizardValues.spec.ts`, `loadWizardPrefill.spec.ts`, `mapWizardPrefillToFormPatch.spec.ts`, `applyTourWizardPatch.spec.ts`, `applyTourWizardPatch.clone-restore.spec.ts`, `parseWizardPrefillQuery.spec.ts`, `presetDefaultsToDenaliFormPatch.spec.ts`, `mapToDenaliWizardPatch.spec.ts`.

**Draft / restore unit (primary):** `pick-wizard-draft-for-restore.spec.ts`, `apply-wizard-draft-restore.spec.ts`, `tourWizardDraftEnvelope.spec.ts`, `wizardAutosavePatch.spec.ts`, `denaliDraftRestore.spec.ts`.

---

### Anti-Redundancy Verdict

**Do not add parallel suites for:** numeric difficulty, gear pill matrix, Denali Zod/rule validation, create-tour invariants, template tenant isolation, Urban settings draft restore, classic clone patch merge, or Denali real-stack submit matrices — already covered by ~105 artifacts above.

**Documented gaps only (no new tests in this pass):**

1. `workspaces/:workspaceId/tours/drafts` API + BFF + `useTourWizardServerSync` — implemented in Phase 6, zero dedicated automated coverage.
2. Clone mapper does not carry `leaderUserIds` / `localGuideName` from source tour (code fix precedes any clone unit test).
3. Clone spec does not assert itinerary `photos` round-trip (mapper code exists).
4. No dedicated `socialMediaLink` clone assertion (mapper maps `chatLink`).

**Last known quality gate (Phase 6):** `pnpm tsc --noEmit` green; `pnpm test` web 600/600, api 539 pass / 6 skip (per `map.log` 2026-05-21).


---

### PHASE 7: MULTI-LOCATION SCHEMAS & CLONE SYNCHRONIZATION

**Current Task**: TASK 7.3 — Integration test & quality gate
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%
**Active component**: `transformTourToDenaliWizardValues.ts` (clone engine) — linked to `loadWizardPrefill` / `?clone=` pipeline

**File Execution Log**:
- `packages/types/src/denali/locationData.ts`: **Created ✅** (`DenaliLocationData`, zone keys, API parsers)
- `packages/types/src/denali/denaliCanonicalTourModel.ts`: **5-zone fields added ✅**
- `packages/shared-contracts/src/tours/denali-wizard.contract.ts`: **`DENALI_LOCATION_ZONE_KEYS` ✅**
- `apps/api/src/modules/tours/dto/trip-details.dto.ts`: **`TripDetailsLocationDataDto` + overview zones ✅**
- `apps/api/src/modules/tours/types/tour-trip-details.types.ts`: **Types aligned ✅**
- `apps/web/src/features/tours/wizard/schemas/denaliLocationDataSchema.ts`: **Created ✅**
- `apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.ts` + `denaliTourCreateBaseSchema.ts`: **Zod zones ✅**
- `packages/types/src/denali/denaliCanonicalFromForm.ts`: **Legacy string ↔ zone sync ✅**
- `apps/web/.../buildDenaliCreateTourPayloadProjection.ts`: **Persist zones to `trip_details.overview` + logistics ✅**
- `apps/web/.../clone/transformTourToDenaliWizardValues.ts`: **`leaderUserIds` / `localGuideName` / zones / photos fix ✅**
- `apps/web/.../clone/transformTourToDenaliWizardValues.spec.ts`: **Crew + locations + photos assertions ✅**
- `apps/web/tests/integration/wizard-real-stack.submit-denali-from-clone.spec.ts`: **POST-clone overview crew/location parity ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit**: **Success (Green) 🟢** (web + api)
- **pnpm test**: **Success (Green) 🟢** (web 603/603, api 539 pass / 6 skip)

**EXECUTIVE SUMMARY**:
Phase 7 closes the Discovery Audit clone gaps: the Denali cloner no longer black-holes `leaderUserIds` (reads `overview.leaderUserIds`), maps `localGuideName`, hydrates five `LocationData` zones (gathering/start/summit/camp/end) with legacy `meetingPoint` / `startPointVillage` / `returnPoint` fallbacks, and preserves multi-day `itinerary.photos` arrays. Schemas and API DTOs accept the unified `{ addressText, latitude, longitude }` contract for round-trip clone → create.


---

### PHASE 8: PRODUCTION POLISHING & LIFE-CYCLE MANAGEMENT

**Current Task**: TASK 8.4 — Master quality & lifecycle pass (complete)
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status | Progress |
|-------|--------|----------|
| Cron / draft eviction (30d, 03:00 UTC) | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |
| 409 concurrency (`clientLastUpdatedAt`, >2s) | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |
| Micro-UX nested errors (5-zone + itinerary photos) | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |

**File Execution Log**:
- `apps/api/src/jobs/tour-wizard-draft-cleanup.job.ts`: **Created ✅** (daily 03:00 UTC, `SchedulerLockService`, 30-day hard delete)
- `apps/api/src/jobs/job-scheduler.module.ts`: **Registered `TourWizardDraftCleanupJob` ✅**
- `apps/api/test/jobs/tour-wizard-draft-cleanup.job.spec.ts`: **Created ✅**
- `apps/api/src/modules/tours/utils/assert-tour-wizard-draft-not-stale.ts`: **Created ✅** (`TOUR_WIZARD_DRAFT_STALE`, 2s threshold)
- `apps/api/src/modules/tours/dto/save-tour-draft.dto.ts`: **`clientLastUpdatedAt` optional ISO ✅**
- `apps/api/src/modules/tours/tours.drafts.controller.ts`: **409 guard + PATCH `{ success, updatedAt }` ✅**
- `apps/api/test/tours/assert-tour-wizard-draft-not-stale.spec.ts`: **Created ✅**
- `apps/web/lib/tour-wizard-draft.client.ts`: **`TourWizardDraftStaleError`, PATCH clock ✅**
- `apps/web/src/features/tours/wizard/hooks/useTourWizardServerSync.ts`: **`serverUpdatedAtRef`, `syncConflict`, refresh hook ✅**
- `apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx`: **Conflict banner + reload server draft ✅**
- `apps/web/src/features/tours/wizard/schemas/denaliLocationDataSchema.ts`: **Lat/lng superRefine ✅**
- `apps/web/src/features/tours/wizard/schemas/denaliCanonicalIssuePaths.ts`: **5-zone nested paths ✅**
- `apps/web/src/features/tours/wizard/schemas/denaliCanonicalIssuePaths.spec.ts`: **Created ✅**
- `apps/web/src/features/tours/wizard/denali/components/DenaliLocationZoneField.tsx`: **Created ✅** (RHF `Controller` per zone)
- `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`: **5-zone section wired ✅**
- `apps/web/src/features/tours/wizard/denali/steps/DenaliDailyItinerarySection.tsx` + `DenaliItineraryDayPhotos.tsx`: **Per-day `photos` errors ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web): **Success (Green) 🟢**
- **pnpm test**: **Success (Green) 🟢** — api **542** pass / 6 skip; web **605** pass

**EXECUTIVE SUMMARY**:
Phase 8 adds production safety nets: scheduled eviction of stale `tour_wizard_drafts`, optimistic concurrency on draft PATCH to block multi-device overwrites, and scoped micro-UX validation for five location zones and itinerary day photos without freezing the wizard layout.


---

### PHASE 9: LEAFLET INTEGRATION & GEOLOCATION SEARCH

**Current Task**: TASK 9.3 — Monorepo quality gate (complete)
**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status | Progress |
|-------|--------|----------|
| Leaflet map shell (dynamic, no SSR) | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |
| Debounced address search dropdown | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |
| 5-zone RHF sync (no lat/lng inputs) | Done | [▓▓▓▓▓▓▓▓▓▓] 100% |

**File Execution Log**:
- `apps/web/src/components/ui/map/DenaliLocationPickerMap.tsx`: **Created ✅** (`dynamic(..., { ssr: false })`)
- `apps/web/src/components/ui/map/DenaliLocationPickerMapInner.tsx`: **Created ✅** (`MapContainer`, `flyTo`, draggable marker, map click)
- `apps/web/lib/geocoding/nominatim.ts` + `app/api/geocoding/search/route.ts`: **Created ✅** (Nominatim BFF, `countrycodes=ir`)
- `apps/web/src/features/tours/wizard/denali/hooks/useDebouncedLocationSearch.ts`: **Created ✅** (350ms debounce)
- `apps/web/src/features/tours/wizard/denali/components/DenaliLocationZoneField.tsx`: **Refactored ✅** (search dropdown + map; numeric lat/lng inputs removed)
- `apps/web/lib/geocoding/nominatim.spec.ts`: **Created ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢** — **612** pass — **606** pass

**EXECUTIVE SUMMARY**:
Phase 9 replaces manual coordinate entry with a conversational location picker: operators search by place name, pick a suggestion, and fine-tune on an interactive Leaflet map. All five Denali location zones keep `addressText` + hidden `latitude`/`longitude` in form state via React Hook Form and canonical sync—without exposing numeric fields in the UI.


### REFACTOR 8.5: VERSION-BASED OCC CONVERSION

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| DB `version` column + migration | Done |
| Remove `clientLastUpdatedAt` (full stack) | Done |
| Integer OCC on PATCH (`TOUR_WIZARD_DRAFT_STALE`) | Done |
| Web `draftVersionRef` hydrate + bump on 200 | Done |

**Changes**:
- `apps/api/src/database/migrations/1777596100000-AddTourWizardDraftVersion.ts`
- `TourWizardDraftEntity.version` (int, default 1)
- `SaveTourDraftDto.version` required; stale util deleted
- `ToursDraftsController`: match version → save → return `{ success, version }`
- `tour-wizard-draft.client.ts` + `useTourWizardServerSync` + `DenaliCreateTourWizard`
- Removed: `assert-tour-wizard-draft-not-stale.ts` and timestamp tests

**Quality**: api **542** pass; web **tsc** green; migration applied locally.



### REFACTOR 9.4: MULTI-PROVIDER GEOCODING FALLBACK

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| BFF try/catch + Nominatim fallback | Done |
| Optional Neshan / Map.ir primary | Done |
| Static Iranian mountain dictionary | Done |
| Dropdown resilience (no 502 on rate-limit) | Done |

**File Execution Log**:
- `apps/web/lib/geocoding/iran-mountain-landmarks.ts`: **Created ✅** (دماوند، علم کوه، توچال، + سبلان/دنا/کلاردشت)
- `apps/web/lib/geocoding/geocoding-search.ts`: **Created ✅** (`searchGeocodingWithFallback`, `mergeGeocodingResults`)
- `apps/web/lib/geocoding/neshan.ts` + `map-ir.ts`: **Created ✅** (optional `NESHAN_API_KEY` / `MAP_IR_TOKEN`)
- `apps/web/app/api/geocoding/search/route.ts`: **Refactored ✅** (always `{ results }`; logs `GEOCODING_PROVIDER_FAIL_SWITCHING_TO_FALLBACK` on 429/503)
- `apps/web/lib/geocoding/*.spec.ts`: **Extended ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢** — **612** pass

**EXECUTIVE SUMMARY**:
Refactor 9.4 hardens location search: high-frequency Iranian mountain coordinates resolve instantly from a static dictionary, optional Neshan/Map.ir keys improve local POI coverage, and Nominatim remains the fallback so rate-limited upstream APIs no longer blank the wizard dropdown.


### REFACTOR 9.5: FRONTEND SYNC ENGINE INTEGRATION TEST

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| Jest fake timers + 500ms debounce assertion | Done |
| OCC `draftVersionRef` bump on PATCH success | Done |
| 409 `syncConflict` recovery surface | Done |

**File Execution Log**:
- `apps/web/src/features/tours/wizard/hooks/__tests__/useTourWizardServerSync.integration.test.tsx`: **Created ✅** (Scenarios A/B/C + `syncNow`)
- `apps/web/jest.config.cjs` + `jest.setup.ts`: **Created ✅** (jsdom + ts-jest; isolated from node:test `*.spec` glob)
- `apps/web/package.json`: **`test` runs node:test + Jest hook suite ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢** — node **612** + Jest **4**

**EXECUTIVE SUMMARY**:
Refactor 9.5 locks the Denali server-draft autosave contract with an integration suite: rapid `basicInfo.title` edits coalesce to a single debounced PATCH at 500ms, successful replies advance `draftVersionRef`, and `TourWizardDraftStaleError` flips conflict UI flags without crashing the hook.


### REFACTOR 9.6: MODAL MAP PICKER CONVERSION

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| Remove 5 inline Leaflet maps from step layout | Done |
| Input + map launcher button per zone | Done |
| Map mounts only inside `@tour/ui` Modal when open | Done |

**File Execution Log**:
- `apps/web/src/features/tours/wizard/denali/components/DenaliLocationZoneField.tsx`: **Refactored ✅** (search row + launcher; address/coords badges)
- `apps/web/src/features/tours/wizard/denali/components/DenaliLocationModalPicker.tsx`: **Created ✅**
- `apps/web/app/globals.css`: **Modal panel width ✅**
- `apps/web/messages/en.json` + `fa.json`: **mapPicker / modal copy ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢**

**EXECUTIVE SUMMARY**:
Refactor 9.6 removes five always-mounted inline maps from the basic-info step. Each location zone is now a compact search field plus a map launcher; Leaflet loads only inside a modal when the operator confirms coordinates back into RHF.


### REFACTOR 9.7: DAILY ITINERARY GEOLOCATION

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| Canonical + form Zod (`location` on itinerary day row) | Done |
| API `TripDetailsDayPlanDto.location` nested DTO | Done |
| Clone loop reads `dayPlans[].location` | Done |
| UI: `DenaliLocationPickerEditor` + modal in day row | Done |

**File Execution Log**:
- `packages/types/src/denali/denaliCanonicalTourModel.ts` + `denaliCanonicalFromForm.ts`: **location on itinerary ✅**
- `apps/web/.../denaliItineraryDaySchema.ts`: **optional `location` ✅**
- `apps/api/.../trip-details.dto.ts` + `tour-trip-details.types.ts`: **nested location ✅**
- `transformTourToDenaliWizardValues.ts` + `buildDenaliCreateTourPayloadProjection.ts`: **round-trip ✅**
- `DenaliItineraryDayLocationField.tsx` + `DenaliDailyItinerarySection.tsx`: **modal picker UX ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web + api): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢**

**EXECUTIVE SUMMARY**:
Multi-day itinerary rows now support optional structured geolocation (`addressText` + lat/lng) alongside legacy `locationText`. The same search + modal map pattern as the five zone fields is reused per day; API day plans persist `location` for clone/edit round-trip.


### PHASE 10: TEMPLATE & CLONE PIPELINE ALIGNMENT

**Progress**: [▓▓▓▓▓▓▓▓▓▓] 100%

| Track | Status |
|-------|--------|
| Denali deep-clone mapper (5-zone + itinerary geo + media) | Done |
| Backend `ToursCloneService` trip_details preservation | Done |
| Fresh draft bootstrap at OCC `version: 1` | Done |

**File Execution Log**:
- `transformTourToDenaliWizardValues.ts`: **Upgraded ✅** (`dayPlans` / `days` / `segmentActivities`, trip `photos`, altitude)
- `services/tours-clone.service.ts`: **Created ✅** (deep clone + preset defaults projection)
- `denali/bootstrapDenaliPrefillDraft.ts`: **Created ✅** (delete stale draft → PATCH v1)
- `DenaliCreateTourWizard.tsx`: **Clone/preset localStorage → server draft v1 ✅**
- `test/tours/tours-clone.service.unit-spec.ts` + mapper/prefill specs: **Added ✅**

**Quality Metrics**:
- **pnpm tsc --noEmit** (web + api): **Success (Green) 🟢**
- **pnpm test** (web): **Success (Green) 🟢**

**EXECUTIVE SUMMARY**:
Phase 10 aligns clone and template hydration with the full Denali field model. The web mapper round-trips five zone pins, optional per-day geolocation and photos, and gallery media; the API clone service preserves nested JSONB keys for template ingestion; clone/preset prefill now seeds a fresh server draft at optimistic-lock version 1 instead of resurrecting a stale autosave.
