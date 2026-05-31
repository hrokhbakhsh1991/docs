# Architecture Map

Living document for enterprise architectural reviews and audit findings.

---

## [Audit 6] Contract Schema Integrity & Currency Semantics

**Review date:** 2026-05-31  
**Severity:** High — three validation layers disagree; dev-only warnings mask paths that can **throw** or send semantically wrong pricing  
**Scope:** Denali create pipeline → `@repo/shared-contracts` → Nest DTOs  
**Code changes in this audit:** None (analysis only)

### Executive summary

Three parallel contracts govern the same `POST /api/tours` body:

1. **Nest `CreateTourDto` / `TripDetails*Dto`** — Denali-extended, permissive.
2. **`tourCreatePostContractSchema` / `tourTripDetailsWireSchema`** — strict `.strict()` Zod in `@repo/shared-contracts`.
3. **Client projection** (`buildDenaliCreateTourPayloadProjection`) — emits Nest-shaped payloads the strict schema never declared.

Failure modes are **layer-dependent**:

| Layer | On drift |
|-------|----------|
| `compactTripDetailsForApi` | **Throws** (`compact-trip-details-for-api.ts:178-182`) |
| `buildCreateTourPostBody` (dev) | **`console.warn` only** (`tours.service.ts:274-282`) — silent in production |
| Nest class-validator | Accepts Denali DTO fields |
| `assertCreateTourInvariants` | Skips trip-details for staging shells (`assert-create-tour-invariants.ts:507-515`) |

**Staging contradiction:** Server waives invariants for `isStagingShell`, but client runs **full submit projection** and **throws** when `capacityMax` is missing (`buildDenaliCreateTourPayloadProjection.ts:561-565`) before POST.

**Currency:** UI Toman integers (e.g. `850_000`) → `cost_context: { currency: "USD", totalCost: <number> }` (`tours.service.ts:193-195`) — wrong semantics; wire Zod expects `totalCost` as **string** (`cost-context-wire.schema.ts:9`).

---

### 1. Pipeline and validation gates

```text
Form → buildDenaliCreateTourPayloadProjection (throws if capacityMax invalid)
     → mapDenaliWizardToCreateTourPayload
     → stripCreateTourDtoForFormProfile (denali_pilot: clearsTripDetailsRoots: [])
     → mapCreateTourDto → compactTripDetailsForApi (strict Zod → THROW)
     → buildCreateTourPostBody (dev: tourCreatePostContractSchema → WARN)
     → Nest DTO + assertCreateTourInvariants
```

---

### 2. Schema drift map — `tripDetails`

Strict schemas: `packages/shared-contracts/src/tours/tour-trip-details-wire.schema.ts` (all `.strict()`).

#### 2.1 `overview` — projection emits, strict Zod **missing**

| Key | Projection | Nest (`trip-details.dto.ts`) | Strict wire |
|-----|------------|------------------------------|-------------|
| `summitPoint` | `buildDenaliCreateTourPayloadProjection.ts:441-443` | Yes (341) | **Missing** |
| `campPoint` | 444-446 | Yes (347) | **Missing** |
| `endPoint` | 447-449 | Yes (353) | **Missing** |
| `denaliTourKind` | 429 | Yes (361) | Listed ✓ |
| `settingsMainDestinationId` | 430 | Yes | Listed ✓ |
| `difficultyLevel` (number 0.5–10) | 450 | Yes | Listed ✓ |

`DENALI_LOCATION_ZONE_KEYS` (`denali-wizard.contract.ts:2-7`) documents zones but wire overview schema was never extended.

#### 2.2 `participation` — drift

| Key | Projection | Nest | Strict wire |
|-----|------------|------|-------------|
| `fitnessPrerequisiteText` | 480-485 | Yes (662) | **Missing** |
| `fitnessLevel` | `low/medium/high` → `easy/moderate/hard` (69-82) | Yes | Enum ✓ |

#### 2.3 `logistics` — drift

| Key | Projection | Nest | Strict wire |
|-----|------------|------|-------------|
| `privateCarMode` | 530 | Yes (921) | **Missing** |
| `startPointVillage` | 514-518 | Yes (736) | **Missing** |
| `fuelShareToman` | 529 | Yes | Listed ✓ |
| `groupSizeMin` / `groupSizeMax` | 527-528 | Yes | Listed ✓ |

#### 2.4 `tripDetails` root — drift

| Key | Projection | Nest | Strict wire |
|-----|------------|------|-------------|
| **`transport`** (`transportCost`, `allowPersonalCar`, `dongAmount`) | 556-557, `buildDenaliTransportJson` 157-180 | `TripDetailsDenaliTransportDto` (1007-1071) | **Root key absent** from `tourTripDetailsWireSchema` (210-220) |

Allowed strict roots: `schemaVersion`, `overview`, `itinerary`, `participation`, `logistics`, `requirements`, `policies`, `photos` only.

#### 2.5 Top-level POST (non–tripDetails)

| Field | Client | Strict Zod | Issue |
|-------|--------|------------|-------|
| `cost_context.totalCost` | **number** | **string** regex | Type drift → dev warn |
| `cost_context.currency` | `"USD"` | 3-char string ✓ | Semantic drift (Toman labeled USD) |
| `metadata` staging | `{ vertical: "staging_shell", isStagingShell: true }` | `tourMetadataWireSchema` ✓ | OK |
| `stagingTourId` | Final submit | UUID optional ✓ | OK |

#### 2.6 When users hit failures

| Scenario | Result |
|----------|--------|
| Mountain form with summit/camp/end zones | `compactTripDetailsForApi` **throw** on submit |
| `organizer_vehicle` / `shared_cars` → `tripDetails.transport` | **Throw** on submit |
| Submit-valid test form (no zones, transport may omit slice) | Compact may pass; **warn** on `totalCost` type |
| Photo upload before `capacityMax` set | Client **throw** at 561-565; never reaches server bypass |

`denali_pilot` keeps all tripDetails roots (`tour-form-profile-descriptors.ts:351-354`, `allowsMountainOnlyOverviewKeys: true`) — full Denali forms are high risk for compact throws.

---

### 3. Silent warnings vs hard failures

```text
mapCreateTourDto → compactTripDetailsForApi
  FAIL → throw Error("wire contract violation …") → no POST

buildCreateTourPostBody (NODE_ENV !== "production")
  tourCreateContractSchema.safeParse(body)
  FAIL → console.warn("[buildCreateTourPostBody] shared wire contract violation: …")
  POST still proceeds
```

Typical dev warning path: **`cost_context.totalCost`** expected string, received number — after tripDetails already passed compact.

---

### 4. Currency semantics (Toman → USD mislabel)

| Stage | Example | File |
|-------|---------|------|
| Wizard | `basePricePerPerson: 850_000` | `denaliUiTestTourFixtures.ts` |
| Projection | `price: 850_000` | `buildDenaliCreateTourPayloadProjection.ts:567-571` |
| Wire | `{ currency: "USD", totalCost: 850000 }` (number) | `buildCostContextForCreate` 193-195 |

No conversion. Nest `CostContextDto.totalCost` is `@IsNumberString()` (`cost-context.dto.ts:21`).

**Recommended alignment:**

- Emit `totalCost` as **string** (minimum wire fix).
- Set `currency: "IRR"` (or product-defined Toman code) for Denali IR market.
- Document semantics in OpenAPI / shared-contracts.

---

### 5. Staging bypass — cleanup proposal

#### 5.1 Current contradiction

| Component | Behavior |
|-----------|----------|
| `createDenaliWizardUploadTour.ts:27-28` | Full `mapDenaliWizardToCreateTourPayload` — no submit gate |
| Projection 561-565 | **Throws** without positive `capacityMax` |
| Lines 34-36 | Title fallback only (`STAGING_TITLE_FALLBACK`) |
| Server 507-515 | Skips trip-details invariants for `isStagingShell` |
| Server DTO | `total_capacity` min **0** accepted |

#### 5.2 Proposed dual projection

```text
mapDenaliWizardToCreateTourPayload(form)       → submit (existing + gate)
mapDenaliWizardToStagingShellPayload(form)    → gallery shell (new)
```

**Staging shell rules (never throw on incomplete wizard):**

| Field | Value |
|-------|-------|
| `title` | User title if ≥10 chars, else `STAGING_TITLE_FALLBACK` |
| `capacity` | Placeholder **`1`** (finalize overwrites on submit) |
| `price` | `0` — omit or minimal `cost_context` |
| `tripDetails` | **Omit** — photos via `POST /api/tours/:id/photos` |
| `lifecycle_status` | `"Draft"` |
| `metadata` | `{ vertical: "staging_shell", isStagingShell: true }` |

**Implementation order:**

1. `buildDenaliStagingShellProjection` with `mode: "staging" | "submit"` — no capacity throw in staging mode.
2. `buildDenaliWizardUploadTourPayload` calls staging projection only (`createDenaliWizardUploadTour.ts:28`).
3. Unit test: default form without `capacityMax` → payload builds without throw.
4. E2E: `apps/api/test/e2e/tours-staging-photos.e2e-spec.ts`.

**Long-term:** draft-engine attachments / deferred tour row (Audit 4 Tier E) removes shell split entirely.

#### 5.3 Wire schema catch-up (parallel)

Extend `tour-trip-details-wire.schema.ts`:

- Overview: `summitPoint`, `campPoint`, `endPoint` (reuse `tripDetailsLocationWireSchema`)
- Participation: `fitnessPrerequisiteText`
- Logistics: `privateCarMode`, `startPointVillage`
- Root: `transport` + `tripDetailsTransportWireSchema`

Validate with `buildWorstCaseDenaliWizardForm.ts` (includes `summitPoint`).

**SSOT rule:** update shared-contracts **with** Nest DTO parity; projection already targets Nest.

---

### 6. Remediation sequence

| Phase | Work |
|-------|------|
| **C0** | `totalCost` as string; `currency: "IRR"` (product sign-off) |
| **C1** | Staging shell projection — no capacity throw |
| **C2** | Extend `tour-trip-details-wire.schema.ts` |
| **C3** | CI fail on `tourCreatePostContractSchema` drift |
| **C4** | Document `cost_context` in OpenAPI |

---

### 7. Verification checklist

1. All location zones → submit without compact throw.
2. `tripDetails.transport` → strict parse passes.
3. No dev `[buildCreateTourPostBody] shared wire contract violation` on valid Denali submit.
4. Photo upload without capacity → staging POST succeeds.
5. Submit with `stagingTourId` → `finalizeStagingTourShell` overwrites placeholder capacity.
6. Persisted `cost_context` uses correct currency semantics, not USD-labeled Toman.

---

### 8. File reference index

| Topic | Path | Lines |
|-------|------|-------|
| Strict tripDetails schemas | `packages/shared-contracts/src/tours/tour-trip-details-wire.schema.ts` | 97-221 |
| Denali projection | `apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.ts` | 427-565 |
| Staging upload | `apps/web/src/features/tours/wizard/denali/createDenaliWizardUploadTour.ts` | 22-37 |
| compact + throw | `packages/shared-contracts/src/tours/compact-trip-details-for-api.ts` | 178-182 |
| Dev warn | `apps/web/lib/services/tours.service.ts` | 187-204, 274-282 |
| Cost wire | `packages/shared-contracts/src/tours/cost-context-wire.schema.ts` | 6-14 |
| Server staging bypass | `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts` | 507-515 |
| Nest overview/transport | `apps/api/src/modules/tours/dto/trip-details.dto.ts` | 341-353, 1007-1071 |
| denali_pilot profile | `packages/types/src/tour-form-profile-descriptors.ts` | 345-363 |
| Location zone keys | `packages/shared-contracts/src/tours/denali-wizard.contract.ts` | 2-7 |

---

### 9. Conclusion

Strict wire schema **lags** Denali/Nest; projection **targets Nest**; `compactTripDetailsForApi` **hard-fails** complete forms while `buildCreateTourPostBody` **only warns** on currency type errors. Staging **inverts trust** — server permissive, client strict. Fix requires wire catch-up, currency alignment, and a **minimal staging projection** as one coordinated contract story.
