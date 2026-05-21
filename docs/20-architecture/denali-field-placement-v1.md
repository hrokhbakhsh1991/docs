# Denali Wizard — Field Placement Standard v1

**Status:** Normative documentation (analysis only; no code changes)  
**Scope:** MVP canonical fields in `DenaliCanonicalTourModel`  
**Sources:** `packages/types/src/denali/denaliCanonicalTourModel.ts`, `denaliRuleModel.ts`, `denaliRuleRequired.ts`, `denaliRuleAccess.ts`, `denaliUIAdapter.ts`, `denaliCanonicalFormAdapter.ts`, `buildDenaliCreateTourPayloadProjection.ts`, step components under `denali/steps/`  
**CI alignment:** Consistent with `packages/ci-templates/denali-wizard/*` gates (canonical registry, rules paths, projection `tripDetails` blocks, UI sync)

**Rail steps (UI):** `denali_basic` → `denali_program` → `denali_transport` → `denali_pricing` → `review`  
**Rule-only step id:** `submit_only` (participants; not a rail tab)  
**Review:** Display and mirror only — **not an owner step** for user input in this standard.

---

## Section 1 — Field inventory table

**Column definitions**

| Column | Meaning |
|--------|---------|
| **Owner Step** | Single authoritative step that owns user input for this field (v1 standard) |
| **Category** | `input` · `conditional` · `derived` · `constant` |
| **Editable** | `yes` · `no` · `conditional` · `read-only` |
| **Visible in Review** | Field shown or edited on `review` rail (mirror/display/input) |
| **Dependency** | Primary controller for visibility or required state |
| **Notes** | RHF path, rule step today, projection, gaps |

**Owner Step values (v1):** `denali_basic` | `denali_program` | `denali_transport` | `denali_pricing` | `denali_photos` | `review_only`

| Field | Owner Step | Category | Editable | Visible in Review | Dependency | Notes |
|-------|------------|----------|----------|-------------------|------------|-------|
| `category` | denali_basic | derived | read-only | yes (label) | `basicInfo.tourType` → basics | Canonical meta; edited via category select + `updateCanonicalBasics`. RHF: `basicInfo.tourType`. Rule step: `denali_basic`. Resolves `denaliRuleSet`. |
| `duration` | denali_basic | derived | read-only | yes (label) | `basicInfo.tourType` → basics | Canonical meta; edited via duration select. Maps `single`/`multi` ↔ `single_day`/`multi_day`. `event` + `multi_day` → rule model `null`. |
| `title` | denali_basic | input | yes | yes (display) | — | UI: `DenaliBasicInfoStep`. RHF `basicInfo.title`. Rule: required `denali_basic`. Projection: `CreateTourDto.title`. |
| `destinationId` | denali_basic | input | yes | no | — | UI: `DestinationCombobox`. RHF `basicInfo.destinationId`. Rule: required `denali_basic`. Projection: `tripDetails.overview.settingsMainDestinationId`. |
| `startDateTime` | denali_basic | input | yes | no | — | UI: `DenaliDatetimeField`. RHF `basicInfo.startDateTime`. Rule: required `denali_basic`. Projection: `logistics.departureDate` + `departureMeetingTime`. |
| `endDateTime` | denali_basic | conditional | conditional | no | `tourType` multi-day (`denaliTourKindToIsMultiDay`) | Rule: hidden single-day / required multi-day on `denali_basic`. Normalization clears when invisible. Contextual required via `CONDITIONALLY_REQUIRED_PATHS` (form path). |
| `capacityMax` | denali_basic | input | yes | no | — | Rule: required `denali_basic`. Projection: `capacity`, `logistics.groupSizeMax`; **assert** positive int at submit. |
| `capacityMin` | denali_basic | input | yes | no | — | Rule: optional `denali_basic`. Projection: `logistics.groupSizeMin`. |
| `meetingPoint` | denali_basic | input | yes | yes (display) | — | Rule: optional `denali_basic`. Projection: `logistics.meetingPoint`. |
| `program.mainThemeId` | denali_program | input | yes | yes (display) | — | UI: `DenaliProgramNatureStep`. RHF `programNature.mainTourThemeId`. Rule: required `denali_program`. Projection: `overview.tourThemeIds[0]`. |
| `program.shortDescription` | denali_program | input | yes | yes (display) | — | Rule: required `denali_program`. Projection: `overview.shortIntro` (+ description fallback). |
| `program.longDescription` | denali_program | input | yes | no | — | Rule: optional `denali_program`. Projection: `CreateTourDto.description`. |
| `program.difficultyLevel` | denali_program | conditional | conditional | yes (display, outdoor) | `category` ≠ `event` | Rule: required visible outdoor / hidden event on `denali_program`. Normalization clears when hidden. Projection: `overview.difficultyLevel` if outdoor. **UI path bug:** step uses `programNature.difficultyLevel` in `arePathsVisible` (see §4). |
| `program.hikingHoursApprox` | denali_program | conditional | conditional | yes (display, outdoor) | `category` ≠ `event` | Same as difficulty. Projection: `itinerary.programNotes` when > 0. |
| `transport.mode` | denali_transport | input | yes | yes (display) | — | UI: `DenaliTransportStep`. RHF `transport.transportMode`. Values: `organizer_vehicle`, `bus`, `minibus`, `shared_cars`, `none`. Rule: required `denali_transport`. Projection: `mapCanonicalTransport` → logistics modes. |
| `transport.allowPersonalCar` | denali_transport | conditional | conditional | yes (display mirror) | `transport.mode` is `bus` or `minibus` | Checkbox «اجازه استفاده از ماشین شخصی». RHF `transport.allowPersonalCar`. Normalization clears when mode is not bus/minibus. Projection: `tripDetails.transport.allowPersonalCar` + logistics supplemental private car. |
| `transport.dongAmount` | denali_transport | conditional | conditional | yes (display mirror) | `shared_cars` **or** (`bus`/`minibus` + `allowPersonalCar`) | Owner input: `denali_transport`. Required when visible. Normalization clears otherwise. Projection: `fuelShareToman` + `tripDetails.transport.dongAmount` when applicable. |
| `transport.transportNotes` | denali_transport | input | yes | no | — | Rule: optional `denali_transport`. UI sync via `applyCanonicalMvpToForm`. Projection: `transportationNotes`. |
| `pricing.requiresPayment` | denali_pricing | input | yes | yes (display) | — | UI: `DenaliPricingPaymentStep` checkbox. Rule: required `denali_pricing`. Projection: price branch + `requiresPayment` flag. |
| `pricing.basePricePerPerson` | denali_pricing | conditional | conditional | yes (display mirror) | `pricing.requiresPayment === true` | Owner input: `denali_pricing`. Contextual visibility + required. Projection: **assert** when paid. |
| `pricing.paymentMode` | denali_pricing | constant | read-only | no | `requiresPayment` (implicit) | Rule: required `denali_pricing`; always `offline_receipt`. **No dedicated control** on pricing step. Projection: set when paid. |
| `participants.minimumAge` | denali_pricing | conditional | conditional | yes (display) | `category === mountain` | Rule: `denali_pricing`. Projection: `participation.minimumAge` (mountain). |
| `participants.maximumAge` | denali_pricing | conditional | conditional | yes (display) | `category === mountain` | Same; optional when visible. Projection: `participation.maximumAge`. |
| `participants.fitnessLevel` | denali_pricing | conditional | conditional | yes (display) | `category === mountain` | Same; required when visible. Projection: `participation.fitnessLevel` via `denaliWizardFitnessToApi`. |
| `participants.sportsInsuranceRequired` | denali_pricing | conditional | conditional | yes (display) | `category === mountain` | Same; required when visible. Projection: `participation.sportsInsuranceRequired`. |
| `policies.policiesText` | denali_pricing | input | yes | yes (display) | — | Rule: `denali_pricing`. Projection: **only** `tripDetails.policies.cancellationPolicy` (from `policiesText`). |
| `policies.cancellationPolicy` | review_only | derived | read-only | no (merged) | `policies.policiesText` | Canonical duplicate. `denaliCanonicalFromForm` sets `policiesText` from form `cancellationPolicy`. Map: both canonical paths → `policies.cancellationPolicy` RHF. **Do not treat as separate input.** |
| `photos` | denali_photos | input | yes | yes (display) | — | Rule: optional `denali_photos`. Projection: `tripDetails.photos`. Max 10 images, <=5MB each. |

**Registry:** All rows except merged `cancellationPolicy` appear in `DENALI_WIZARD_CANONICAL_FIELD_PATHS` (25 inventory rows; **25** paths in Set including `transport.allowPersonalCar`).

**Derived / non-canonical display on review (not inventory rows):** `eventVariant` (basics), `denaliTourKind` (projection only), theme display name.

---

## Section 2 — Step boundaries

### `denali_basic`

| | |
|--|--|
| **Purpose** | Tour identity, schedule, capacity, destination, classification (category/duration/tourType). |
| **Allowed** | `title`, `destinationId`, `startDateTime`, `endDateTime`, `capacityMax`, `capacityMin`, `meetingPoint`, classification controls (`category`, `duration`, `eventVariant` via basics). |
| **Forbidden** | Program copy/themes, transport, pricing, participant requirements, standalone policies. |

### `denali_program`

| | |
|--|--|
| **Purpose** | Program content and outdoor-specific program attributes. |
| **Allowed** | `program.mainThemeId`, `program.shortDescription`, `program.longDescription`, `program.difficultyLevel`, `program.hikingHoursApprox` (latter two when category is outdoor). |
| **Forbidden** | Basic schedule/capacity, transport, pricing, participants, policies. |

### `denali_transport`

| | |
|--|--|
| **Purpose** | Transport mode and shared-car economics. |
| **Allowed** | `transport.mode`, `transport.allowPersonalCar`, `transport.dongAmount`, `transport.transportNotes`. |
| **Forbidden** | Basic info (except meeting point — owned by basic), program fields, pricing, participants, policies. |

### `denali_pricing`

| | |
|--|--|
| **Purpose** | Payment intent, price per person, **v1 standard** home for participant requirements and optional policy notes before review. |
| **Allowed** | `pricing.requiresPayment`, `pricing.basePricePerPerson`, `pricing.paymentMode` (constant), `participants.*` (mountain), `policies.policiesText` (optional). |
| **Forbidden** | Core schedule/title/destination, program theme/copy, transport mode (except notes unrelated to price). |

### `denali_photos`

| | |
|--|--|
| **Purpose** | Upload and manage tour photos before review. |
| **Allowed** | `photos` array. |
| **Forbidden** | Any other fields. |

### `review_only`

| | |
|--|--|
| **Purpose** | Read-only summary of values owned by prior steps; no new canonical input in v1. |
| **Allowed** | Display rows for fields owned elsewhere; derived labels (`category`, `duration`, event variant). |
| **Forbidden** | Owning editable canonical fields (current code violates this for participants + `policiesText`). |

### `review` (rail step — not an owner)

| | |
|--|--|
| **Purpose** | Confirm and submit; mirror all prior owners. |
| **Allowed** | `<ReviewRow>` display, conditional mirrors (`dongAmount`, `basePricePerPerson`, outdoor program). |
| **Forbidden** | Declaring new owner steps; duplicate input ownership (see §4). |

---

## Section 3 — Visibility rules

### 3.1 Static rule-model visibility (`field.hidden` in `denaliRuleSet`)

| Field(s) | Condition | Effect |
|----------|-----------|--------|
| `endDateTime` | `single_day` duration in rule model | `hidden: true`, not required |
| `endDateTime` | `multi_day` duration in rule model | visible, required |
| `program.difficultyLevel`, `program.hikingHoursApprox` | `event` category | `hidden: true` |
| `program.difficultyLevel`, `program.hikingHoursApprox` | mountain / nature / desert | visible, required (outdoor) |
| `participants.*` | non-mountain categories | `hidden: true` (all four paths) |
| `participants.*` | mountain | visible on `submit_only` rule step |
| `denaliRuleSet.event.multi_day` | — | `null` (no model; duration switch disallowed) |

### 3.2 Contextual visibility (`denaliUIAdapter.isDenaliFieldContextuallyVisible`)

| Canonical path | Controller | Visible when |
|----------------|------------|--------------|
| `transport.allowPersonalCar` | `transport.mode` | `bus` or `minibus` |
| `transport.dongAmount` | `transport.mode` + `allowPersonalCar` | `shared_cars` **or** (`bus`/`minibus` + `allowPersonalCar === true`) |
| `pricing.basePricePerPerson` | `pricing.requiresPayment` (RHF `pricingPayment.requiresPayment`) | `true` |

### 3.3 Contextual required (`denaliRuleRequired.isDenaliFieldRequired`)

| Path | Controller | Required when |
|------|------------|---------------|
| `endDateTime` | multi-day `tourType` | `denaliTourKindToIsMultiDay(form.basicInfo.tourType)` |
| `transport.dongAmount` | transport mode + personal car flag | `shared_cars` **or** (`bus`/`minibus` + `allowPersonalCar`) |
| `pricing.basePricePerPerson` | payment flag | `requiresPayment === true` |

`CONDITIONALLY_REQUIRED_PATHS` (submit scope) uses **form** paths: `basicInfo.endDateTime`, `transport.dongAmount`, `pricingPayment.basePricePerPerson`.

### 3.4 Review-step visibility (`isDenaliFieldVisibleOnStep` + `step === "review"`)

On `review`, any non-hidden field in the rule model is visible for display (`field.step` check bypassed). Used for summary rows and review-section inputs.

### 3.5 Ghost field clearing (`normalizeDenaliWizardForm` → `clearDenaliNonVisibleFormValues`)

Clears canonical leaves (via `mapDenaliCanonicalToFormPath`) when:

1. Path listed in `getHiddenFieldPathsFromModel(model)` (`field.hidden === true`), or  
2. Path in `DENALI_WIZARD_CANONICAL_FIELD_PATHS`, present in model, and `!isDenaliFieldVisibleInModel(model, path, form)` (includes contextual rules).

**Typical transitions that clear ghosts**

| Transition | Fields cleared |
|------------|----------------|
| Single-day ↔ multi-day | `endDateTime` when switching to single-day |
| Outdoor ↔ event | `program.difficultyLevel`, `program.hikingHoursApprox` |
| Mountain ↔ other category | all `participants.*` |
| `shared_cars` ↔ other transport | `transport.dongAmount` |
| `bus`/`minibus` ↔ other transport | `transport.allowPersonalCar`, `transport.dongAmount` |
| Uncheck `allowPersonalCar` | `transport.dongAmount` |
| Paid ↔ free | `pricing.basePricePerPerson` when not required |
| Category/duration change (`updateCanonicalBasics`) | All non-visible per new model |

### 3.6 UI sync (`applyCanonicalMvpToForm`)

One-way canonical → RHF for MVP slices: `basicInfo`, `programNature`, `transport`, `pricingPayment`, `participantRequirements`, `policies.cancellationPolicy` (not `policiesText` leaf separately). Does not assign owner step; preserves non-MVP RHF fields on `existingForm` spread.

### 3.7 Projection guards (`buildDenaliCreateTourPayloadProjection`)

| Field | Guard |
|-------|--------|
| `capacityMax` | `throw` if not positive integer |
| `pricing.basePricePerPerson` | `throw` if paid and not positive integer |
| `participants.fitnessLevel` | omitted unless mountain + value set |
| `program.difficultyLevel` / `hikingHoursApprox` | omitted for `event` category |
| `policies` | API `cancellationPolicy` from `canonical.policies.policiesText` only |

---

## Section 4 — Duplication report

### 4.1 Fields appearing on multiple rail contexts (today)

| Field | Owner (v1) | Also appears | Issue |
|-------|------------|--------------|-------|
| `transport.dongAmount` | denali_transport | review (display row) | Mirror OK if read-only; OK |
| `pricing.basePricePerPerson` | denali_pricing | review (display row) | Mirror OK |
| `program.difficultyLevel`, `program.hikingHoursApprox` | denali_program | review (display) | Mirror OK |
| `participants.*` | denali_pricing | review (display row) | Resolved: moved to pricing step |
| `policies.policiesText` | denali_pricing | review (display row) | Resolved: moved to pricing step |
| Most basic/program/transport/pricing fields | respective owner | review (display only) | OK |

### 4.2 Canonical vs RHF path splits

| Canonical | RHF | Issue |
|-----------|-----|-------|
| `category` | `basicInfo.tourType` | Intentional rename; rules use `category` |
| `program.mainThemeId` | `programNature.mainTourThemeId` | Section name mismatch |
| `transport.mode` | `transport.transportMode` | Leaf rename |
| `pricing.*` | `pricingPayment.*` | Section rename |
| `participants.*` | `participantRequirements.*` | Section rename |
| `policies.cancellationPolicy` + `policies.policiesText` | both → `policies.cancellationPolicy` | **Duplicate canonical → one RHF leaf** |

### 4.3 Review + input step duplication

| Field | Rule `step` | UI input location | Status |
|-------|-------------|-------------------|--------|
| `participants.minimumAge` | `denali_pricing` | `DenaliPricingStep` | Resolved: input on pricing |
| `participants.maximumAge` | `denali_pricing` | `DenaliPricingStep` | Resolved: input on pricing |
| `participants.fitnessLevel` | `denali_pricing` | `DenaliPricingStep` | Resolved: input on pricing |
| `participants.sportsInsuranceRequired` | `denali_pricing` | `DenaliPricingStep` | Resolved: input on pricing |
| `policies.policiesText` | `denali_pricing` | `DenaliPricingStep` | Resolved: input on pricing |
| `policies.cancellationPolicy` | `review_only` | none (collapsed) | Redundant canonical path |

### 4.4 UI vs rules path mismatch

| Location | Paths used | Expected (canonical) |
|----------|------------|----------------------|
| `DenaliProgramNatureStep` `arePathsVisible` | `programNature.difficultyLevel`, `programNature.hikingHoursApprox` | `program.difficultyLevel`, `program.hikingHoursApprox` |
| `DenaliBasicInfoStep` `isVisible` | `"endDateTime"` | works via `findDenaliRuleField` on canonical path |
| `CONDITIONALLY_REQUIRED_PATHS` | form paths | canonical `endDateTime`, `transport.dongAmount`, `pricing.basePricePerPerson` preferred for registry consistency |

### 4.5 Projection vs canonical mismatches

| Canonical | Projection / form behavior | Issue |
|-----------|---------------------------|-------|
| `policies.cancellationPolicy` | not written; uses `policiesText` only | Orphan canonical field |
| `policies.policiesText` | API `policies.cancellationPolicy` | Single persistence path OK if documented |
| `pricing.paymentMode` | hard-coded `offline_receipt` when paid | Required in rules but not user-edited |
| Legacy RHF fields (gear, extra policies) | not in canonical | Survive `existingForm` spread; not normalized by registry |

### 4.6 CI / map.log observations (historical)

- Rules gate once compared **form** paths to `denaliRuleSet` (false warnings); fixed by checking `path: "..."` in `denaliRuleModel.ts`.
- Projection gate once expected `tripDetails.overview` string literals; code uses nested object keys.
- `transportNotes` UI sync called out as explicit fix in CI Phase 1.

---

## Section 5 — Recommended final state

### 5.1 Minimal ideal step layout (no UI redesign)

Keep the **5-step rail**. Assign ownership:

```
denali_basic      → classification, schedule, capacity, destination, meetingPoint
denali_program    → program.* (incl. outdoor conditional)
denali_transport  → transport.*
denali_pricing    → pricing.* + participants.* (mountain) + optional policies.policiesText
review            → display-only mirror + submit (no canonical owners)
review_only       → derived-only canonical (cancellationPolicy alias, display-only meta mirrors)
```

### 5.2 Fields that should move (suggestions only)

| Field | Current input surface | Target owner (v1) | Action |
|-------|----------------------|-------------------|--------|
| `participants.*` | Review section (editable) | `denali_pricing` (or restored `denali_participants` rail) | Move controls to pricing step **or** reintroduce participants rail; keep review display-only |
| `policies.policiesText` | Review textarea | `denali_pricing` (optional) or dedicated policies step | Move optional notes before review; review shows read-only row |
| `policies.cancellationPolicy` | n/a (duplicate) | remove from canonical or alias | Collapse to `policiesText` only in model + map |
| `pricing.paymentMode` | nowhere (constant) | `denali_pricing` | Mark `constant` in rules; drop `required` UI flag or hide from rule required |
| `program.difficultyLevel`, `program.hikingHoursApprox` | program step | denali_program | Fix `arePathsVisible` paths to canonical |

### 5.3 Do not change (stable)

- Canonical model as SoT for MVP field set.
- `denaliRuleSet` category × duration matrix.
- Normalization via `DENALI_WIZARD_CANONICAL_FIELD_PATHS` + contextual visibility.
- Projection `tripDetails` five blocks (overview, itinerary, participation, logistics, policies).
- CI gate scripts under `packages/ci-templates/denali-wizard/`.

### 5.4 Determinism checklist (for future PRs)

- [ ] Each canonical path: exactly one Owner Step from §1.
- [ ] No editable canonical field on `review` except mirrors marked read-only.
- [ ] `CANONICAL_TO_FORM_PATH_MAP`: one RHF leaf per canonical path.
- [ ] Rule `field.step` equals Owner Step (replace `submit_only` / `review` input steps).
- [ ] UI `isVisible(ownerStep, canonicalPath)` — no `programNature.*` in rule calls.
- [ ] Gates 1–5 green; field-update manifest matches registry.

---

## Appendix A — Canonical → RHF → projection quick reference

| Canonical | RHF | Primary projection target |
|-----------|-----|---------------------------|
| `title` | `basicInfo.title` | `title` |
| `category` | `basicInfo.tourType` | `tripDetails.overview.denaliTourKind`, `tourType` |
| `destinationId` | `basicInfo.destinationId` | `overview.settingsMainDestinationId` |
| `startDateTime` | `basicInfo.startDateTime` | `logistics.departureDate/Time` |
| `endDateTime` | `basicInfo.endDateTime` | `logistics.returnDate/Time` |
| `capacityMax` | `basicInfo.capacityMax` | `capacity`, `groupSizeMax` |
| `capacityMin` | `basicInfo.capacityMin` | `groupSizeMin` |
| `meetingPoint` | `basicInfo.meetingPoint` | `logistics.meetingPoint` |
| `program.mainThemeId` | `programNature.mainTourThemeId` | `overview.tourThemeIds` |
| `program.shortDescription` | `programNature.shortDescription` | `overview.shortIntro` |
| `program.longDescription` | `programNature.longDescription` | `description` |
| `program.difficultyLevel` | `programNature.difficultyLevel` | `overview.difficultyLevel` |
| `program.hikingHoursApprox` | `programNature.hikingHoursApprox` | `itinerary.programNotes` |
| `transport.mode` | `transport.transportMode` | logistics transport modes |
| `transport.dongAmount` | `transport.dongAmount` | `fuelShareToman` |
| `transport.transportNotes` | `transport.transportNotes` | `transportationNotes` |
| `pricing.requiresPayment` | `pricingPayment.requiresPayment` | `price`, `requiresPayment` |
| `pricing.basePricePerPerson` | `pricingPayment.basePricePerPerson` | `price` when paid |
| `pricing.paymentMode` | `pricingPayment.paymentMode` | `paymentMode` when paid |
| `participants.minimumAge` | `participantRequirements.minimumAge` | `participation.minimumAge` |
| `participants.maximumAge` | `participantRequirements.maximumAge` | `participation.maximumAge` |
| `participants.fitnessLevel` | `participantRequirements.fitnessLevel` | `participation.fitnessLevel` |
| `participants.sportsInsuranceRequired` | `participantRequirements.sportsInsuranceRequired` | `participation.sportsInsuranceRequired` |
| `policies.policiesText` | `policies.cancellationPolicy` | `policies.cancellationPolicy` |
| `policies.cancellationPolicy` | `policies.cancellationPolicy` | (duplicate — use `policiesText` only) |

---

## Appendix B — Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-20 | Initial field placement standard (analysis-only) |

**Related:** [`denali-wizard-field-mapping.md`](./denali-wizard-field-mapping.md) · [`map.md`](../../map.md) · [`map.log`](../../map.log) · `packages/ci-templates/denali-wizard/run-denali-field-update.ts`
