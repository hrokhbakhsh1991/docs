# Denali canonical domain model (MVP)

Read-only domain extraction from `DenaliCreateTourWizardForm` (`denaliTourCreateSchema.ts`).  
Goal: fewer user-facing concepts, no redundant stored state, stable adapter boundary to `CreateTourDto`.

**TypeScript source of truth:** `packages/types/src/denali-canonical-tour-model.ts` → `DenaliCanonicalTourModel`.

---

## 1. Design principles

| Problem (current form) | MVP canonical approach |
|------------------------|-------------------------|
| 8 `tourType` slugs encode category **and** duration | Split: `category` + `duration` (+ `eventVariant` for events) |
| `isMultiDay` duplicates slug suffix | **Derived** from `duration` only |
| `difficultyType` ghost field + side effects | **Derived** from `category` (`event` → `none`, else `physical`) |
| Theme vs “tour type” confusion | **`category`** = product line; **`mainThemeId`** = workspace marketing theme (catalog) |
| Transport: 6 modes × private car × 4 dong modes | **`mobility`** enum + optional `carshareAmountPerSeat` |
| Five policy textareas | Single optional **`policies.notes`** for MVP |
| `paymentMode`, `includesTransportInPrice` | **Derived** / **removed** (not in canonical user model) |

---

## 2. `DenaliCanonicalTourModel` (user inputs only)

```typescript
// See packages/types/src/denali-canonical-tour-model.ts
interface DenaliCanonicalTourModel {
  basics: { title, category, duration, eventVariant?, destinationId, schedule, capacity, meetingPoint? };
  program: { mainThemeId, shortDescription, longDescription?, outdoorDetails? };
  transport: { mobility, description?, carshareAmountPerSeat?, notes? };
  pricing: { isPaid, pricePerPerson? };
  requirements: { minAge?, maxAge?, fitnessLevel?, sportsInsuranceRequired?, medicalNotes?, technicalNotes? };
  policies?: { notes? };
}
```

**Derived at adapter boundary** (`DenaliDerivedPersistenceView`): `denaliTourKind`, `apiTourType`, `isMultiDay`, `difficultyType`, `paymentMode`.

---

## 3. Legacy form inventory (39 leaf fields)

All paths on `DenaliCreateTourWizardForm`:

### `basicInfo` (9)

| Field | Kind | Notes |
|-------|------|-------|
| `title` | user_input | → `basics.title` |
| `tourType` | **replaced** | → `basics.category` + `duration` + `eventVariant?` |
| `destinationId` | user_input | → `basics.destinationId` |
| `startDateTime` | user_input | → `basics.schedule.startsAt` |
| `endDateTime` | user_input | → `basics.schedule.endsAt` |
| `isMultiDay` | **derived** | → from `basics.duration` |
| `capacityMax` | user_input | → `basics.capacity.max` |
| `capacityMin` | user_input | → `basics.capacity.min` |
| `meetingPoint` | user_input | → `basics.meetingPoint` |

### `programNature` (9)

| Field | Kind | Notes |
|-------|------|-------|
| `mainTourThemeId` | user_input | → `program.mainThemeId` |
| `secondaryTourThemeIds` | **remove MVP** | Defer post-MVP |
| `shortDescription` | user_input | → `program.shortDescription` |
| `longDescription` | user_input | → `program.longDescription` |
| `difficultyType` | **derived** | From `basics.category` |
| `difficultyLevel` | user_input* | → `program.outdoorDetails.difficultyLevel` (*outdoor only) |
| `hikingHoursApprox` | user_input* | → `program.outdoorDetails.hikingHoursApprox` (*outdoor only) |
| `altitudeGainApprox` | **remove MVP** | Plugin / phase 2 |
| `itineraryOutline` | **remove MVP** | Plugin / phase 2 |

### `transport` (6)

| Field | Kind | Notes |
|-------|------|-------|
| `primaryTransportMode` | **replaced** | → `transport.mobility` (simplified enum) |
| `primaryTransportDescription` | user_input | → `transport.description` |
| `privateCarAllowed` | **derived** | From `mobility` |
| `privateCarMode` | **derived** | From `mobility` + `carshareAmountPerSeat` |
| `dongAmountPerSeat` | user_input† | → `transport.carshareAmountPerSeat` (†when applicable) |
| `transportNotes` | user_input | → `transport.notes` |

### `pricingPayment` (4)

| Field | Kind | Notes |
|-------|------|-------|
| `requiresPayment` | user_input | → `pricing.isPaid` |
| `basePricePerPerson` | user_input | → `pricing.pricePerPerson` |
| `includesTransportInPrice` | **remove MVP** | Not persisted in mapper today |
| `paymentMode` | **internal_only** | Constant `offline_receipt` at adapter |

### `participantRequirements` (8)

| Field | Kind | Notes |
|-------|------|-------|
| `minimumAge` | user_input | → `requirements.minAge` |
| `maximumAge` | user_input | → `requirements.maxAge` |
| `fitnessLevel` | user_input* | → `requirements.fitnessLevel` (*outdoor/mountain rules) |
| `experienceLevel` | **remove MVP** | Defer |
| `requiredGearIds` | **remove MVP** | Defer (gear module) |
| `optionalGearIds` | **remove MVP** | Defer |
| `sportsInsuranceRequired` | user_input* | → `requirements.sportsInsuranceRequired` (*mountain rule) |
| `medicalNotes` | user_input | → `requirements.medicalNotes` |
| `technicalSkillNotes` | user_input | → `requirements.technicalNotes` |

### `policies` (5)

| Field | Kind | Notes |
|-------|------|-------|
| `cancellationPolicy` | **merged MVP** | → `policies.notes` (single field) or defer |
| `refundPolicy` | **merged MVP** | same |
| `attendanceRules` | **merged MVP** | same |
| `safetyPolicy` | **merged MVP** | same |
| `weatherPolicy` | **merged MVP** | same |

---

## 4. Mapping table: old form path → canonical

| Old path (`DenaliCreateTourWizardForm`) | New path (`DenaliCanonicalTourModel`) | Transform |
|---------------------------------------|-------------------------------------|-----------|
| `basicInfo.title` | `basics.title` | 1:1 |
| `basicInfo.tourType` | `basics.category`, `basics.duration`, `basics.eventVariant?` | Split slug (see §5) |
| `basicInfo.isMultiDay` | *(derived)* | `duration === "multi_day"` |
| `basicInfo.destinationId` | `basics.destinationId` | 1:1 |
| `basicInfo.startDateTime` | `basics.schedule.startsAt` | 1:1 |
| `basicInfo.endDateTime` | `basics.schedule.endsAt` | 1:1 |
| `basicInfo.capacityMax` | `basics.capacity.max` | 1:1 |
| `basicInfo.capacityMin` | `basics.capacity.min` | 1:1 |
| `basicInfo.meetingPoint` | `basics.meetingPoint` | 1:1 |
| `programNature.mainTourThemeId` | `program.mainThemeId` | Rename only |
| `programNature.secondaryTourThemeIds` | — | **Removed MVP** |
| `programNature.shortDescription` | `program.shortDescription` | 1:1 |
| `programNature.longDescription` | `program.longDescription` | 1:1 |
| `programNature.difficultyType` | *(derived)* | `denaliDifficultyTypeFromCategory(category)` |
| `programNature.difficultyLevel` | `program.outdoorDetails.difficultyLevel` | When outdoor |
| `programNature.hikingHoursApprox` | `program.outdoorDetails.hikingHoursApprox` | When outdoor |
| `programNature.altitudeGainApprox` | — | **Removed MVP** |
| `programNature.itineraryOutline` | — | **Removed MVP** |
| `transport.primaryTransportMode` | `transport.mobility` | Simplified mapping (§6) |
| `transport.primaryTransportDescription` | `transport.description` | 1:1 |
| `transport.privateCarAllowed` | *(derived)* | From `mobility` |
| `transport.privateCarMode` | *(derived)* | From `mobility` + amount |
| `transport.dongAmountPerSeat` | `transport.carshareAmountPerSeat` | 1:1 when applicable |
| `transport.transportNotes` | `transport.notes` | 1:1 |
| `pricingPayment.requiresPayment` | `pricing.isPaid` | Rename |
| `pricingPayment.basePricePerPerson` | `pricing.pricePerPerson` | 1:1 |
| `pricingPayment.includesTransportInPrice` | — | **Removed MVP** |
| `pricingPayment.paymentMode` | *(internal)* | Always `offline_receipt` |
| `participantRequirements.*` | `requirements.*` | See §3 (subset) |
| `policies.*` (×5) | `policies.notes` | Concatenate on migrate; split on expand |

---

## 5. Slug split: `tourType` → category + duration + eventVariant

| Legacy `basicInfo.tourType` | `basics.category` | `basics.duration` | `basics.eventVariant` |
|----------------------------|-------------------|-------------------|------------------------|
| `mountain_day` | `mountain` | `single_day` | — |
| `mountain_multi` | `mountain` | `multi_day` | — |
| `nature_day` | `nature` | `single_day` | — |
| `nature_multi` | `nature` | `multi_day` | — |
| `desert_day` | `desert` | `single_day` | — |
| `desert_multi` | `desert` | `multi_day` | — |
| `event_reading` | `event` | `single_day` | `reading` |
| `event_cinema` | `event` | `single_day` | `cinema` |

Inverse: `denaliTourKindFromCanonical()` in `@repo/types`.

**Product note:** Events are modeled as `single_day` in MVP; multi-day events would extend `duration` later without new slugs.

---

## 6. Transport (implemented MVP)

Form shape (`denaliTourCreateSchema`):

| Field | Values |
|-------|--------|
| `transport.transportMode` | `organizer_vehicle` \| `shared_cars` \| `none` |
| `transport.dongAmount` | Required when `shared_cars`; forbidden otherwise |
| `transport.transportNotes` | Optional |

**Legacy → new** (`@repo/types` `migrateLegacyDenaliTransportForm` / `normalizeDenaliTransportForm`):

| Legacy | New |
|--------|-----|
| `primaryTransportMode: "none"` | `transportMode: "none"` |
| `privateCarAllowed` or `private_car` or dong modes | `shared_cars` + `dongAmount` |
| `bus` / `train` / `van` / `minibus` (no private car) | `organizer_vehicle` |

**API mapper** (`mapDenaliWizardToCreateTourPayload`): `organizer_vehicle` → `bus`; `shared_cars` → `bus` + `private_car` + `fuelShareToman` + `privateCarMode: car_share_fixed_dong`; `none` → empty `transportModes`.

No RHF side effects on transport; draft restore normalizes legacy keys via `mergeDenaliWizardDefaults`.

---

## 7. Fields to **REMOVE** from MVP

| Field | Reason |
|-------|--------|
| `basicInfo.isMultiDay` | Redundant with `duration` |
| `basicInfo.tourType` (8 slugs as UI value) | Replaced by `category` + `duration` + `eventVariant` |
| `programNature.difficultyType` | Derived from category |
| `programNature.secondaryTourThemeIds` | Low value / complexity |
| `programNature.altitudeGainApprox` | Phase 2 / mountain plugin |
| `programNature.itineraryOutline` | Phase 2 |
| `pricingPayment.includesTransportInPrice` | Not mapped to API |
| `pricingPayment.paymentMode` (as form state) | Pilot constant only |
| `participantRequirements.experienceLevel` | Defer |
| `participantRequirements.requiredGearIds` | Gear module plugin |
| `participantRequirements.optionalGearIds` | Gear module plugin |
| `policies.cancellationPolicy` | Merged into `policies.notes` |
| `policies.refundPolicy` | Merged |
| `policies.attendanceRules` | Merged |
| `policies.safetyPolicy` | Merged |
| `policies.weatherPolicy` | Merged |
| `transport.privateCarAllowed` | Derived from `mobility` |
| `transport.privateCarMode` | Derived from `mobility` + amount |

**MVP user-input count:** 39 legacy leaves → **~22** canonical leaves (see interface in types package).

---

## 8. Fields to **DERIVE** (do not store in canonical model)

| Derived value | Source |
|---------------|--------|
| `denaliTourKind` | `denaliTourKindFromCanonical({ category, duration, eventVariant })` |
| `apiTourType` | `denaliApiTourTypeFromCategory(category)` |
| `isMultiDay` | `duration === "multi_day"` |
| `difficultyType` | `denaliDifficultyTypeFromCategory(category)` |
| `paymentMode` | `"offline_receipt"` (pilot) |
| `privateCarAllowed` | `mobility === "participant_cars"` or mobility implies cars |
| `privateCarMode` | From `mobility` + presence of `carshareAmountPerSeat` |
| `primaryTransportMode` (API) | Adapter from `mobility` (bus collapse, etc.) |
| Outdoor-only UI visibility | `isDenaliOutdoorCategory(category)` |
| Mountain-only validation | `category === "mountain"` |
| Event-only `eventVariant` requirement | `category === "event"` |

---

## 9. Category vs theme (disambiguation)

| Concept | Canonical field | Meaning |
|---------|-----------------|---------|
| **Product category** | `basics.category` | What kind of tour (mountain, event, …) — drives validation & API `tourType` |
| **Marketing theme** | `program.mainThemeId` | Workspace catalog row (e.g. “کوهپیمایی آلپ”) — drives `tripDetails.overview.tourThemeIds` |

Do **not** infer category from theme or vice versa. Presets may set both; each has a single job.

---

## 10. MVP validation matrix (canonical)

| Rule | Condition |
|------|-----------|
| `endsAt` required | `duration === "multi_day"` |
| `endsAt` after `startsAt` | both set |
| `eventVariant` required | `category === "event"` |
| `outdoorDetails` required | outdoor category |
| `outdoorDetails` forbidden | `category === "event"` |
| `pricePerPerson` required | `isPaid === true` |
| `pricePerPerson` empty/zero | `isPaid === false` |
| `minAge` ≤ `maxAge` | both set |
| Mountain: `minAge`, `fitnessLevel`, `sportsInsuranceRequired === true` | `category === "mountain"` |
| Carshare amount | `mobility === "participant_cars"` and product rule requires amount |

---

## 11. Next steps (no UI in this change)

1. Implement `canonicalToWizardForm` / `wizardFormToCanonical` adapters (feature layer).
2. Point new validation at `DenaliCanonicalTourModel` + derive before `mapDenaliWizardToCreateTourPayload`.
3. Migrate UI tabs to edit canonical shape (or thin RHF wrapper).
4. Keep persisting `denaliTourKind` on API for round-trip until API accepts category+duration.
