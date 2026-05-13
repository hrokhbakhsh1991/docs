# Tour wizard — Phase 0 completion pack (field groups & contracts)

This document **closes engineering Phase 0** from `prompt.md` §14: inventory of wizard fields → **field groups**, documentation of **`mapFormValuesToBackendPayload`** / **`mapCreateTourDto`**, API **invariant** entry points, and a **v1 profile → field-groups matrix** (engineering default; product sign-off tracked below).

---

## 1. Exit criteria checklist (`prompt.md` Phase 0)

| Criterion | Status | Notes |
|-----------|--------|--------|
| Inventory wizard steps & fields; each field assigned to **exactly one** field group | Done | §3 tables (one primary `field_group_id` per RHF path). |
| Document `mapFormValuesToBackendPayload` (and related create pipeline) | Done | §4. |
| Document API invariant functions used after DTO parse | Done | §5. |
| Enum list + **profile → groups** matrix v1 | Done | Enum: `@repo/types` `TOUR_FORM_PROFILE_VALUES`. Matrix: §6. |
| PM / product **sign-off** on matrix v1 | **Pending** | Fill §7 before treating the matrix as product-approved. |

---

## 2. Wizard steps (canonical rail)

Ordered step ids: `basic` → `theme` → `capacity` → `location` → `itinerary` → `participation` → `logistics` → `policies` → `review`.

**Code:** `apps/web/src/features/tours/wizard/stepConfig.ts` (`wizardSteps`, `stepTriggerFields`, `stepTitlesFa`).

**Profile-aware visibility (v1):** implemented in `apps/web/src/features/tours/wizard/fieldGroups.ts` as `getVisibleWizardStepsForProfile` (re-exported from `tourWizardStepPlan.ts` for a stable import path). Behaviour:

1. **Primary-group skip:** `getSkippedWizardStepsForProfile(profile)` removes steps whose *primary* field group is inactive for that profile (aligned with §6 “hidden steps”).
2. **Trigger-root redundancy:** for each remaining step, every path in `stepTriggerFields[step]` is mapped to a top-level `TourCreateFormValues` key (`tourCreateRootKeyFromTriggerPath`). If **all** such roots are in `inactiveTourCreateRootKeysForProfile(profile)`, the step is dropped (`isWizardStepRedundantForInactiveTourRoots`). This complements (1) when triggers or profiles evolve.

Must stay aligned with §6 “hidden steps” column.

---

## 3. Field groups & RHF path ownership (audit spine)

Each **React Hook Form** path below has **one primary** `field_group_id`. That id is the unit future work will use for **strip-on-save**, Zod `pick`/`omit`, and server mirrors (`prompt.md` Phases 2–4).

### 3.1 Group definitions (id → wizard step anchor)

| `field_group_id` | Primary wizard step | Role |
|------------------|---------------------|------|
| `basic_info` | `basic`, `theme` | Identity, marketing text, tour type/styles on `basic`; تم اصلی/فرعی روی گام `theme`؛ auto-accept + comms روی `basic`. |
| `pricing_capacity` | `capacity` | Price + numeric capacity drivers used with create DTO `capacity` / `price`. |
| `schedule_location` | `location` | Dates, meeting times, geography, meeting/return points, display location. |
| `itinerary` | `itinerary` | Multi-day program + segments → `trip_details.itinerary` (+ legacy `dayPlans`). |
| `participation` | `participation` | Audience, requirements, gear, insurance flags, ages, etc. |
| `logistics` | `logistics` | Transport mode, services, accommodation/meals, guide languages, group size bounds. |
| `policies` | `policies` | Cancellation, safety, attendance, weather, etc. |
| `review` | `review` | Read-only summary step — **no exclusive RHF roots** (reuses all groups). |

Reserved for future themed JSON (not bound to dedicated components today): `cinema_details`, `cultural_details`.

### 3.2 Exhaustive path → group map (`TourCreateFormValues`)

| RHF path | `field_group_id` | Mapper / notes |
|----------|------------------|------------------|
| `autoAcceptRegistrations` | `basic_info` | → `CreateTourDto.autoAcceptRegistrations` |
| `overview.title` | `basic_info` | → `CreateTourDto.title` |
| `overview.slug` | `basic_info` | **Not** sent by `mapFormValuesToBackendPayload` today (schema field; persist path TBD). |
| `overview.mainTourThemeId` | `basic_info` | → `trip_details.overview.tourThemeIds` (ordering via helper) |
| `overview.secondaryTourThemeIds` | `basic_info` | → same |
| `overview.tourType` | `basic_info` | → `CreateTourDto.tourType` (via `toTourType`) |
| `overview.tripStyles` | `basic_info` | → `trip_details.overview.tripStyles` |
| `overview.shortDescription` | `basic_info` | Feeds `shortIntro` / card text via `deriveShortDescription` |
| `overview.longDescription` | `basic_info` | → `CreateTourDto.description` (trim) |
| `overview.highlights` | `basic_info` | → `trip_details.itinerary.highlights` |
| `overview.locationSummary` | `basic_info` | Not mapped in `mapFormValuesToBackendPayload` (present in schema). |
| `overview.communicationLink` | `basic_info` | → `CreateTourDto.communicationLink` |
| `pricing.basePrice` | `pricing_capacity` | → `CreateTourDto.price` |
| `pricing.currency` | `pricing_capacity` | Not mapped to DTO in wizard mapper (optional UI). |
| `pricing.discountNotes` | `pricing_capacity` | Not mapped in wizard mapper (optional UI). |
| `schedule.startDate` | `schedule_location` | → `trip_details.logistics.departureDate` (YMD) |
| `schedule.endDate` | `schedule_location` | → `trip_details.logistics.returnDate` |
| `schedule.departureMeetingTime` | `schedule_location` | → `trip_details.logistics.departureMeetingTime` |
| `schedule.returnMeetingTime` | `schedule_location` | → `trip_details.logistics.returnMeetingTime` |
| `location.regionId` | `schedule_location` | → `trip_details.overview.settingsRegionId` |
| `location.mainDestinationId` | `schedule_location` | → `trip_details.overview.settingsMainDestinationId` + `CreateTourDto.destinationId` |
| `location.secondaryDestinationIds` | `schedule_location` | Not in wizard mapper object (schema supports; API path may use PATCH / other flows). |
| `location.meetingPoint` | `schedule_location` | Co-mapped with `logistics.meetingPointDetails` → `trip_details.logistics.meetingPoint` |
| `location.returnPoint` | `schedule_location` | → `trip_details.logistics.returnPoint` |
| `location.displayLocation` | `schedule_location` | → `CreateTourDto.location` |
| `itinerary.days` (+ nested segment fields) | `itinerary` | → `trip_details.itinerary.segmentActivities` + `dayPlans` |
| `participation.*` (all keys in schema) | `participation` | → `trip_details.participation.*` (subset; see mapper) |
| `participation.minParticipants` | `participation` | Also feeds **fallback** for `CreateTourDto.capacity` when max/min missing (`mapFormValuesToBackendPayload`) — primary **display** step is `capacity`; **strip ownership** stays `participation`. |
| `logistics.*` (all keys in schema) | `logistics` | → `trip_details.logistics.*`, `CreateTourDto.transportModes` |
| `policies.*` (all keys in schema) | `policies` | → `trip_details.policies.*` (several wizard keys merge per mapper) |
| `logistics.groupSizeMin` / `logistics.groupSizeMax` | `logistics` | Used with `participation.minParticipants` for `CreateTourDto.capacity` |

**Cross-field validation (client)** lives in `tourCreateSchema` `superRefine`: e.g. theme main∉secondary, schedule vs itinerary days, HH:mm ordering, logistics min/max, transport+fuel, region+destination pairing. **Keep in sync** with API rules in §5 when changing profiles.

---

## 4. Create pipeline: mappers (form → wire)

### 4.1 `mapFormValuesToBackendPayload`

- **File:** `apps/web/src/features/tours/wizard/domain/mapWizardFormToCreateTourPayload.ts`
- **Export:** `mapFormValuesToBackendPayload(formValues: TourCreateFormValues): CreateTourDto`
- **Role:** Wizard-only mapping from **full** RHF shape → a `CreateTourDto`-shaped object (including nested `tripDetails` as built in-file). Unit tests: `mapWizardFormToCreateTourPayload.spec.ts`.
- **Phase 4 (client strip):** the wizard submit path calls `stripInactiveTourCreateGroupsForProfile(resolvedProfile, values)` in `fieldGroups.ts` **before** this mapper (via `useTourWizardCreate`), resetting top-level roots owned by inactive groups to `buildTourCreateFormDefaultValues()` so hidden steps cannot leak into the payload.
- **Phase 4 (server strip):** `ToursService.createTour` resolves profile from `tripDetails.overview.tourThemeIds[0]` (+ tenant workspace) then runs `stripCreateTourDtoForFormProfile` before `assertCreateTourInvariants` — see `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`. **`updateTour`:** after merging `tripDetails` (and when `transportModes` alone changes), the same **tripDetails strip** + urban `transportModes` clear runs on the persisted merge candidate before catalog checks / `validateTripDetailsCanonical`.

**Highlights:**

- Derives `transportModes` from `logistics.primaryTransportMode` + `supplementalPrivateCar` (`midibus` → `bus`).
- Copies schedule YMD into `trip_details.logistics.departureDate` / `returnDate` when regex-valid.
- Merges several wizard **policies** strings into API `trip_details.policies` keys per legacy layout (see source comments in mapper).
- Sets `lifecycle_status: "Draft"` for wizard create.

### 4.2 `mapCreateTourDto` (second hop before HTTP)

- **File:** `apps/web/src/features/tours/domain/mapCreateTourDto.ts`
- **Export:** `mapCreateTourDto(payload, { themeCatalog? })`
- **Role:** Shared **sanitizer** for all create entry points: inject optional `locationSection`, **`applyTourThemeOverviewEnrichment`** (labels from catalog), **`compactTripDetailsForApi`**, derive **`durationDays`** from logistics dates, trim top-level fields, drop `undefined` keys for JSON.
- **Wizard path:** `useTourWizardCreate` → `stripInactiveTourCreateGroupsForProfile` → `mapFormValuesToBackendPayload` → `mapCreateTourDto(..., { themeCatalog })` → HTTP client.

### 4.3 Related client invariants

- **`compactTripDetailsForApi`**: `apps/web/src/features/tours/models/tourTripDetails.schema.ts` — structural cleanup before API (used inside `mapCreateTourDto`).
- **Deprecated shim:** `apps/web/lib/mappers/mapTourCreateFormToDto.ts` re-exports the wizard mapper; new code should import from `@/features/tours/wizard/domain/...`.

---

## 5. API invariants (post–class-validator)

### 5.1 DTO boundary (`CreateTourDto`)

- **File:** `apps/api/src/modules/tours/dto/create-tour.dto.ts`
- **Pipe:** Nest `ValidationPipe` (global) — length, enums, nested `tripDetails` DTO, `transportModes`, `tourType`, etc.

### 5.2 Domain invariants on merged shape

- **File:** `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts`
- **`validateTripDetailsCanonical(td, rootTransportModes?)`** — rules (throw `BadRequestException` with `error.code` = `VALIDATION_FIELD_FORMAT_INVALID` where applicable):
  - `logistics.groupSizeMax` ≥ `groupSizeMin` when both set.
  - **Fuel share:** if `transportModes` contains `private_car` and/or `primaryTransportMode === "private_car"`, require `fuelShareToman`.
  - **Return meeting after departure** when both HH:mm set.
  - **Ages:** `maximumAge` ≥ `minimumAge` when both set.
  - **Itinerary vs schedule duration:** max `segmentActivities[].dayNumber` and max `dayPlans[].day` must not exceed computed duration from `departureDate`/`returnDate` when all present.
- **`assertCreateTourInvariants(dto)`** — calls `validateTripDetailsCanonical(dto.tripDetails, dto.transportModes)` after DTO parse.

**Call sites (representative):**

- `ToursService` create path invokes `assertCreateTourInvariants` before persistence.
- Update / merge flows call `validateTripDetailsCanonical` on persisted `tripDetails` with tour `transportModes` (see `tours.service.ts` usages of these symbols).

**Tests:** `apps/api/src/modules/tours/utils/assert-create-tour-invariants.spec.ts`

---

## 6. Profile → field groups matrix (engineering v1)

**Form profile enum** (`TourFormProfile`): `@repo/types` → `TOUR_FORM_PROFILE_VALUES`.

**Phase P10 (promptq.md) — declarative descriptor:** the inactive-group column below is now encoded as
`TOUR_FORM_PROFILE_DESCRIPTORS[profile].inactiveFieldGroups` in
`packages/types/src/tour-form-profile-descriptors.ts`. The web rail reads it via
`apps/web/src/features/tours/wizard/fieldGroups.ts:getInactiveFieldGroupsForProfile` (parity tests
in `packages/types/src/tour-form-profile-descriptors.spec.ts` and
`apps/web/src/features/tours/wizard/profileRules/parity-with-server.spec.ts` keep the table and
the code in lock-step). When this matrix changes, update the descriptor row **and** this doc table
in the same PR.

**Convention:** `active` = group contributes to UX and, in future phases, to validation/strip. When a **wizard step** is hidden for a profile, all RHF paths whose primary group is tied to that step are **candidates** for strip-on-save once Phase 4 exists.

| `TourFormProfile` | Hidden wizard steps (v1 UI) | Inactive field groups (v1 matrix) | Active field groups |
|-------------------|----------------------------|-------------------------------------|------------------------|
| `general` | — | — | all 8 |
| `mountain_outdoor` | — | — | all 8 |
| `nature_trip` | — | — | all 8 |
| `cultural_tour` | — | — | all 8 |
| `cinema_event` | `itinerary`, `participation` | `itinerary`, `participation` | `basic_info`, `pricing_capacity`, `schedule_location`, `logistics`, `policies`, `review` |
| `urban_event` | `itinerary`, `participation`, `logistics` | `itinerary`, `participation`, `logistics` | `basic_info`, `pricing_capacity`, `schedule_location`, `policies`, `review` |

> **Resolved (Phase 3 bridge):** `tourCreateValidationPolicy` + flags set from `TourCreateWizard` drive Zod: for `urban_event`, `logistics.primaryTransportMode` and fuel rules are skipped; for `cinema_event` / `urban_event`, empty `itinerary.days` is allowed and per-day titles are relaxed when the profile hides the itinerary step. Full **schema composition** per profile remains Phase 4 (`withProfileRefinements`).

---

## 7. PM / product sign-off (manual)

| Artifact | Owner | Approved (Y/N) | Date |
|----------|-------|----------------|------|
| §6 profile → groups matrix v1 | | | |
| §3 ownership for `overview.slug` / `locationSummary` / unmapped pricing fields | | | |

---

## 8. Canonical code index (bookmark)

| Concern | Location |
|---------|----------|
| Wizard Zod schema | `apps/web/src/components/tours/wizard/schemas/tourCreateSchema.ts` |
| Profile → Zod refinement flags (Phase 4 bridge) | `tourCreateValidationPolicy.ts` (`tourFormProfileToWizardValidationFlags`) |
| Step list & per-step RHF triggers | `apps/web/src/features/tours/wizard/stepConfig.ts` |
| Theme details step (Phase 3 shell) | `apps/web/src/components/tours/wizard/steps/ThemeDetailsStep.tsx` |
| Profile → visible steps (+ trigger redundancy) | `apps/web/src/features/tours/wizard/fieldGroups.ts` (`getVisibleWizardStepsForProfile`); re-export `tourWizardStepPlan.ts` |
| Profile resolution (theme + draft meta) | `apps/web/src/features/tours/wizard/tourWizardProfileResolve.ts` |
| Field group registry (Phase 2) | `apps/web/src/features/tours/wizard/fieldGroups.ts` |
| Checklists Phases 1–3 (FA) | `docs/20-architecture/tour-wizard-phases-1-3-checklists.md` |
| Empty wizard defaults (shared with strip) | `apps/web/src/features/tours/wizard/tourCreateFormDefaults.ts` |
| Strip inactive groups before create DTO | `fieldGroups.ts` (`stripInactiveTourCreateGroupsForProfile`) |
| Tour edit: strip flat tripDetails for profile | `apps/web/src/features/tours/wizard/stripTourFormTripDetailsForProfile.ts` |
| Wizard create hook | `apps/web/src/features/tours/wizard/hooks/useTourWizardCreate.ts` |
| Playwright smoke: clone `?clone=` | `apps/web/tests/smoke/tour-wizard-clone-query.spec.ts` |
| API create DTO | `apps/api/src/modules/tours/dto/create-tour.dto.ts` |
| API create: resolve theme profile + strip `tripDetails` | `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts` (`ToursService.createTour`) |
| API update (PATCH): same strip on merged `tripDetails` | `ToursService.updateTour` → `applyTourFormProfileStripToPersistedTripDetails` |
| API trip-details invariants | `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts` (`validateTripDetailsCanonical`, **`assertTripDetailsForFormProfile`**: `VALIDATION_PROFILE_TRANSPORT_NOT_ALLOWED`, **`VALIDATION_PROFILE_PHANTOM_PARTICIPATION`**, **`VALIDATION_PROFILE_PHANTOM_ITINERARY`**); **pre-strip incoming** phantoms: `assertIncomingTripDetailsBeforeFormProfileStrip` → `VALIDATION_PROFILE_INCOMING_*` |
