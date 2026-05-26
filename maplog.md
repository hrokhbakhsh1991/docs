# Map Log

Operational audit trail for workspace architecture migrations.


---

## Audit: Rule Engine & Capability Layer Fidelity (2026-05-26)

### Summary

| Layer | Status |
|-------|--------|
| **Web `getCapabilitiesForProfile()`** | Introduced; **3 production call sites** (shell + geo publish). Service catalog (`availableServices`) defined but **not consumed** by Wizard / Register UI yet. |
| **API `WorkspaceStrategyRegistry`** | **4** direct `resolve()` sites; publish/geo/strip flags also via `getWorkspaceUiCapabilityFlags()` in shared-contracts. |
| **Denali rule engine** | Separate matrix (`denaliRuleSet`, `collectDenaliRuleRequiredIssues`) — not routed through capability registry. |
| **Registration** | Tour-field `RegistrationFieldPolicy`; **no** capability registry; `selectedServiceIds` on wire/API metadata — **no** UI catalog wiring yet. |

---

### 1. Production files — raw workspace profile string branching

Excludes `*.spec.ts`, `tests/**`, `scripts/**`. Strategy/registry **definition** homes listed as canonical, not bypass.

#### apps/web

| File | Line(s) | Pattern |
|------|---------|---------|
| apps/web/src/components/tours/TourForm.tsx | 268, 329-331, 395 | `=== "denali_pilot"` |
| apps/web/app/(app)/settings/tour-presets/tour-preset-list.tsx | 148, 254 | `formProfile === "denali_pilot"` |
| apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx | 551 | `formProfile === "mountain_outdoor"` |
| apps/web/src/features/tours/config/tripDetailsFieldConfig.ts | 215 | `profile === "mountain_outdoor"` |
| apps/web/src/features/tours/domain/peak-experience.ts | 53 | `mountain_outdoor` / `denali_pilot` |
| apps/web/src/features/tours/domain/stripTourFormTripDetailsForProfile.ts | 37 | `profile === "urban_event"` |
| apps/web/src/features/tours/wizard/denali/validation/denaliWizardPublishReadiness.ts | 94 | `profile === "denali_pilot"` |
| apps/web/src/features/tours/wizard/denali/hooks/useDenaliPublishReadiness.ts | 36 | hardcoded `"denali_pilot"` |
| apps/web/src/features/tours/wizard/validation/strict-profile-validator.ts | 27, 37 | `=== "general"` |
| apps/web/src/features/tours/wizard/tourWizardProfileResolve.ts | 109, 122, 153 | `=== "general"` |
| apps/web/src/features/tours/wizard/domain/ruleModelConverter.ts | 38 | `raw === "denali"` |
| apps/web/src/features/tours/wizard/isDenaliWizardContext.ts | 28, 39 | `wizardMode === "denali"` |
| apps/web/src/features/tours/wizard/workspace-wizard.config.ts | 62 | `wizardMode === "denali"` |
| apps/web/src/features/tours/wizard/tourWizardStepPlan.ts | 38 | `isDenaliWizardContext(...)` |
| apps/web/src/features/tours/wizard/profiles/mapWizardPrefillToFormPatch.ts | 35 | `isDenaliPilotFormProfile` |
| apps/web/src/features/tours/wizard/profiles/mapPresetToFormPatch.ts | 24 | `isDenaliPilotFormProfile` |
| apps/web/src/features/tours/wizard/sources/loadWizardPrefill.ts | 90 | `isDenaliWizardModeFromProfile` |
| apps/web/src/features/tours/wizard/denaliWizardDraftEnvelope.ts | 54 | `isDenaliWizardModeFromProfile` |
| apps/web/src/features/tours/edit/updateTourDtoFromDenaliWizardForm.ts | 31 | default `"denali_pilot"` |
| apps/web/src/features/tours/wizard/denali/denaliThemeFilter.ts | 28-31 | hardcoded profile slug arrays |

#### apps/api (consumer bypass only)

| File | Line(s) | Pattern |
|------|---------|---------|
| apps/api/src/modules/tours/strategies/workspace.strategy.builders.ts | 42 | `profile === "denali_pilot"` (strategy builder home) |
| apps/api/src/modules/tours/strategies/workspace.strategy.registry.ts | 16 | `profile === "denali_pilot"` (registry home) |
| apps/api/src/modules/tours/strategies/denali.workspace.strategy.ts | 70 | `this.profile !== "denali_pilot"` (strategy home) |

#### Canonical (intentional)

| File | Line(s) |
|------|---------|
| packages/shared-contracts/src/tours/workspace-ui-capabilities.ts | 43 (`profile === "denali_pilot"` for flags + service catalog) |
| packages/types/src/tour-form-profile-descriptors.ts | per-profile descriptor rows |

---

### 2. UI: Capability Registry vs other sources

#### Uses getCapabilitiesForProfile / usesDenaliWizardShellForProfile (production)

| File | Line(s) | Field |
|------|---------|-------|
| apps/web/src/components/tours/tour-schema.ts | 32, 70 | `requiresGeoPublish` |
| apps/web/app/(app)/tours/[id]/edit/tour-edit-client.tsx | 20, 70 | `usesDenaliWizardShell` |
| apps/web/src/components/tours/wizard/TourCreateWizard.tsx | 9, 25-36, 124 | `usesDenaliWizardShell` |

#### Parallel layer (NOT capability registry)

- `buildWizardConfig` / `isDenaliWizardContext` — tourWizardStepPlan.ts:38, resolve-public-site-config.ts:57, tourCreateSchema.ts exports
- `isDenaliPilotFormProfile` / `isDenaliWizardModeFromProfile` — prefill, presets, drafts (see table above)

#### Denali rule engine (field validation; separate from capabilities)

- DenaliCreateTourWizard.tsx:650, 713 — getDenaliWizardPublishReadinessIssues
- DenaliTourEditForm.tsx:546
- apps/web/src/features/tours/wizard/denali/rules/**, denaliRuleRequired.ts, denaliRuleAccess.ts
- Classic: profileRules/**, wizardStepEngine.ts (descriptor + BASE_FIELD_RULES)

#### Registration — no capability registry

| File | Notes |
|------|-------|
| apps/web/src/features/registrations/components/PublicRegisterForm.tsx | RegistrationFieldPolicy from tour API only |
| apps/web/app/(app)/tours/[id]/register/register-for-tour-client.tsx | useTourDetail + resolveTourAllowPrivateCar |
| apps/api/src/modules/registrations/registrations.service.ts | participant_metadata merge; placement from tripDetails |

---

### 3. Capability bypass (UI logic without getCapabilitiesForProfile)

| Priority | File:line | Issue | Use instead |
|----------|-----------|-------|-------------|
| P0 | TourForm.tsx:268,329-331,395 | denali_pilot gates | requiresGeoPublish, usesDenaliWizardShell |
| P0 | denaliWizardPublishReadiness.ts:94 | denali_pilot geo | requiresGeoPublish |
| P0 | PublicRegisterForm.tsx (all) | no catalog | availableServices |
| P1 | tour-create-trip-details-fields.tsx:551 | mountain_outdoor | allowsMountainOverviewFields |
| P1 | tripDetailsFieldConfig.ts:215 | mountain_outdoor | allowsMountainOverviewFields |
| P1 | peak-experience.ts:53 | profile strings | allowsMountainOverviewFields |
| P1 | tour-preset-list.tsx:148,254 | denali_pilot UI | usesDenaliWizardShell |
| P1 | stripTourFormTripDetailsForProfile.ts:37 | urban_event | descriptor/capabilities strip |
| P2 | tourWizardStepPlan.ts:38 | isDenaliWizardContext | usesDenaliWizardShell |
| P2 | mapWizardPrefillToFormPatch.ts:35, mapPresetToFormPatch.ts:24 | deprecated helpers | usesDenaliWizardShellForProfile |

---

### 4. API registry coverage

**WorkspaceStrategyRegistry.resolve():** assert-create-tour-invariants.ts, create-tour-form-profile-strip.ts, assert-profile-required-fields-for-submit.ts, assert-tour-publish-transition.ts

**getWorkspaceUiCapabilityFlags():** denali.workspace.strategy.ts:28,38; assert-tour-publish-transition.ts:26

**No registry:** registrations/**, pricing/**, tour-lifecycle.policy.ts, assert-edit-required-trip-details-for-publish.ts

---

### 5. Target component scorecard

| Component | getCapabilitiesForProfile | Rule engine / descriptor | Hardcoded profile === |
|-----------|---------------------------|--------------------------|------------------------|
| TourCreateWizard | Shell only | N/A | No in file |
| DenaliCreateTourWizard | No | Primary | Via publish hook caller |
| TourForm | No | Partial | Yes |
| tour-edit-client | Shell only | Via DenaliTourEditForm | No in file |
| PublicRegisterForm | No | No | No (tour-driven) |
| register-for-tour-client | No | No | No |
| tour-schema | requiresGeoPublish only | Zod by profile | No |

---

*End of audit entry.*

---

## Audit: JSONB Persistence Integrity — participant_metadata (2026-05-26)

### Scope

- Merge path: `RegistrationsService.participantMetadataForPersistence()` → `participantMetadataRecordForPersistence()` → `registrations.participant_metadata` JSONB.
- Wire contracts: `RegistrationRequestSchema` (Zod), `CreateRegistrationDto` (class-validator), `ParticipantMetadataDto` (nested).
- Create paths: `createRegistration()` (transaction) and `createPublicRegistrationOrWaitlist()` (same helper).

### How merge works today

```text
CreateRegistrationDto
  ├─ participantMetadata?: ParticipantMetadataDto   → userPastPeaksCount, transportIntake only
  ├─ transportMode / isDriver / plateNumber / shareFuelCost  → derived transportIntake (wins over nested)
  └─ selectedServiceIds?: string[]                    → top-level only

participantMetadataRecordForPersistence()  →  base: { userPastPeaksCount?, transportIntake? }
participantMetadataForPersistence()        →  { ...base, selectedServiceIds? }  OR base alone
Entity insert (single transaction)         →  full JSONB replace on new row (not read-modify-write)
```

**Code references:**

| Step | File | Lines |
|------|------|-------|
| Merge orchestration | `apps/api/src/modules/registrations/registrations.service.ts` | 997–1033 |
| Base metadata builder | `apps/api/src/modules/registrations/utils/registration-transport-intake.ts` | 35–53 |
| Create persist (auth) | `registrations.service.ts` | 276–359 (`dataSource.transaction`) |
| Create persist (public) | `registrations.service.ts` | 1940–1965 |
| Entity column | `apps/api/src/modules/registrations/registration.entity.ts` | 76–77 |

### Q1: Risk if we add 10 more service IDs — overwrite / corrupt existing metadata?

**On create (current code): Low risk of corrupting *other* keys.**

- Persistence builds a **new** object per registration insert; there is **no** load-merge-save of an existing `participant_metadata` row on create.
- Merge is **additive across logical sources**: `base` keys (`userPastPeaksCount`, `transportIntake`) are composed first; `selectedServiceIds` is added in a second spread. No key overlap today (`participantMetadataRecordForPersistence` never emits `selectedServiceIds`).
- **10 IDs** are stored as one array value: `{ selectedServiceIds: ["id1", …, "id10"] }`. That does not clobber `userPastPeaksCount` or `transportIntake`.

**Caveats (fragility, not immediate corruption):**

| Risk | Severity | Detail |
|------|----------|--------|
| **Whole-array replace** | Medium (future) | If a later PATCH reuses this helper without reading existing JSONB, sending a new `selectedServiceIds` would **replace** the entire array, not union with prior selections. |
| **No dedupe / no catalog validation** | Medium | `normalizeSelectedServiceIds` only trims/filters empty strings; duplicate or unknown IDs are stored as-is. |
| **Unbounded payload** | Medium | Zod: `z.array(z.string())` with no `.max()`; DTO: `@IsArray()` + `@IsString({ each: true })` but no `@ArrayMaxSize` or per-id `@MaxLength`. Ten IDs is fine; hundreds could bloat JSONB. |
| **Dual input channels** | Low today | `selectedServiceIds` is **only** accepted top-level on `CreateRegistrationDto`. Nested `participantMetadata` cannot carry services (`ParticipantMetadataDto` has no such field; whitelist forbids extras). |
| **Pre-persist vs persisted split** | Low | `resolveInitialRegistrationPlacement` and `assertTravelerMeetsPeakRequirementOrThrow` read **`createDto.participantMetadata` (DTO)**, not the merged JSONB. Peaks must stay in nested DTO; services only appear after merge. |

**Verdict for +10 services on create:** Does **not** overwrite peaks/transport intake; **does** replace the full `selectedServiceIds` array if the client resends the field.

### Q2: Strict shape vs “bag of data”?

#### Ingress (strict at HTTP boundary)

| Layer | Strict? | Notes |
|-------|---------|-------|
| `RegistrationRequestSchema` | **Yes (top-level)** | `.strict()` — unknown keys rejected. `selectedServiceIds` optional `string[]` only. |
| `mapIntakeToRegistrationRequest` | **Gap** | Does **not** map `selectedServiceIds` from intake yet (`registration-request.schema.ts` 61–77). |
| `CreateRegistrationDto` | **Yes (top-level)** | Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true` (`main.ts` 86–87). |
| `ParticipantMetadataDto` | **Yes (nested)** | Only `userPastPeaksCount`, `transportIntake`; nested whitelist. |

#### Persistence & egress (loose)

| Layer | Strict? | Notes |
|-------|---------|-------|
| `RegistrationEntity.participantMetadata` | **No** | `Record<string, unknown>` — TypeORM JSONB “bag”. |
| `participantMetadataForPersistence` return | **No** | Built as `Record<string, unknown>`; only convention defines keys. |
| `GetRegistrationDto.participantMetadata` | **No** | `Record<string, unknown> \| null` — clients see whatever was stored. |
| DB | **No** | No CHECK constraint or JSON schema on `participant_metadata`. |

**Conclusion:** Contracts are **strict on the way in** (top-level DTO/Zod), but the **stored JSONB is an informal bag** with no version field, no shared Zod schema for the persisted document, and no server-side validation against `availableServices` catalog.

### Transaction integrity

- `createRegistration`: entire flow inside `this.dataSource.transaction(async (manager) => { ... })` (`registrations.service.ts` ~276).
- `createPublicRegistrationOrWaitlist`: runs inside caller-provided / nested transaction pattern with same single `manager.create` + `saveRegistrationOrVersionConflict` (~1940).
- `participant_metadata` is set once on insert; **no** separate JSONB update in the same flow.

**Verdict:** Single-transaction create is preserved; metadata is not written in a second detached update.

### Lean/scalable vs risky/fragile

| Dimension | Assessment |
|-----------|------------|
| **MVP / lean** | **Yes** — No migration; one JSONB column; small merge function; clear separation of peaks/transport vs service ids; create-only avoids RMW races. |
| **Scale (many keys / workspaces)** | **Weak** — Each new concern adds another top-level DTO field **or** another informal JSONB key; no `participant_metadata` contract in `@repo/shared-contracts`. |
| **Integrity** | **Moderate risk** — No catalog validation (client can persist arbitrary strings); read paths use partial typed views (`ParticipantMetadataIntake` only peaks). |
| **Evolvability** | **Fragile** — Without `metadataVersion` or a Zod `ParticipantMetadataPersistedSchema`, consumers must defensively read unknown keys; finance/pricing integration will need disciplined key names. |

### Overall rating

**Short term (2–10 add-on IDs):** **Lean and acceptable** — merge logic does not stomp existing metadata keys on create.

**Medium term (catalog growth, PATCH edits, pricing):** **Fragile unless tightened** — recommend:

1. Shared `ParticipantMetadataPersistedSchema` in `@repo/shared-contracts` (keys: `userPastPeaksCount`, `transportIntake`, `selectedServiceIds`, optional `version`).
2. Validate `selectedServiceIds` ⊆ workspace `availableServices` at API boundary.
3. `z.array(z.string().max(64)).max(20)` (or similar) on wire schema.
4. On any future PATCH: read-merge-write with explicit per-key rules (array replace vs union documented).
5. Wire `mapIntakeToRegistrationRequest` to pass `selectedServiceIds` when UI ships.

### Related files (quick index)

| File | Role |
|------|------|
| `packages/shared-contracts/src/booking/registration-request.schema.ts` | Zod wire; `selectedServiceIds` L46 |
| `apps/api/src/modules/registrations/dto/create-registration.dto.ts` | API DTO; `selectedServiceIds` L220–228 |
| `apps/api/src/modules/registrations/dto/participant-metadata.dto.ts` | Nested strict shape |
| `apps/api/src/modules/registrations/utils/registration-transport-intake.ts` | Base JSONB keys |
| `apps/api/src/modules/registrations/registrations.service.ts` | Merge + transaction create |
| `apps/api/src/modules/registrations/utils/peak-experience-placement.ts` | Reads peaks from DTO only |

---

*End of JSONB persistence audit.*

---

## Audit: "Arctic Workspace" Test — simulating `arctic_pilot` (2026-05-26)

### Scenario

Add a **new** closed profile slug `arctic_pilot` (distinct from existing `nature_trip`, which already maps to `ARCTIC_WORKSPACE` in [`workspace-registry.ts`](packages/shared-contracts/src/tours/workspace-registry.ts) with classic rail and min-capacity validation).

Assumption: `arctic_pilot` uses **classic** wizard + Arctic-style rules (min capacity 5, slim roots), **not** Denali 6-tab rail — unless noted in the Denali variant table below.

### Is the system workspace-agnostic?

**No — not workspace-agnostic for onboarding a new workspace identity.**

| Layer | Agnostic? | Why |
|-------|-----------|-----|
| Runtime behavior **within** a registered profile | **Mostly** | `GeneralWorkspaceStrategy` + `getTourFormProfileDescriptor` + `buildWizardConfig` / `getCapabilitiesForProfile` derive strip, steps, and flags from descriptor + `TOUR_WORKSPACE_DEFINITIONS`. |
| Adding a **new profile slug** | **No** | Closed tuple in `@repo/types`, totality table in descriptors, explicit map in workspace registry, **Postgres CHECK** enums on themes/presets/tours, i18n keys, content-workspace default map. |
| Denali-class workspaces | **No** | Extra lists: `DENALI_STRATEGY_PROFILES`, `DENALI_WIZARD_PROFILES`, `usesDenaliCanonicalTemplate`, `workspace-ui-capabilities` `denali_pilot` branch. |
| UI shell selection | **Partial** | `TourCreateWizard` uses capabilities for shell; Denali components still hardcode rule engine / `"denali_pilot"` publish hooks (see prior fidelity audit). |

**Existing overlap:** `nature_trip` already consumes `ARCTIC_WORKSPACE` ([`arctic.ts`](packages/shared-contracts/src/tours/workspaces/arctic.ts) L7 hardcodes `profile: "nature_trip"`). `arctic_pilot` still needs its **own** registry entry and descriptor row even if validation is copy-pasted from Arctic.

---

### Manual change inventory (production / contract code)

#### Tier A — **Required** for any new `arctic_pilot` profile (9 files)

| # | File | Line(s) | Change |
|---|------|---------|--------|
| 1 | [`packages/types/src/tour-form-profile.ts`](packages/types/src/tour-form-profile.ts) | 10–18 | Add `"arctic_pilot"` to `TOUR_FORM_PROFILE_VALUES` (source of truth). |
| 2 | [`packages/types/src/tour-form-profile-descriptors.ts`](packages/types/src/tour-form-profile-descriptors.ts) | ~248–355 | New `arcticPilot` descriptor object + key in `TOUR_FORM_PROFILE_DESCRIPTORS` (totality enforced L357–370). |
| 3 | [`packages/shared-contracts/src/tours/workspaces/arctic.ts`](packages/shared-contracts/src/tours/workspaces/arctic.ts) or **new** `arctic-pilot.ts` | 6–33 | New `TourWorkspaceDefinition` with `profile: "arctic_pilot"` (cannot reuse single `ARCTIC_WORKSPACE` as-is — profile field is fixed to `nature_trip` today). |
| 4 | [`packages/shared-contracts/src/tours/workspace-registry.ts`](packages/shared-contracts/src/tours/workspace-registry.ts) | 9–13 | `arctic_pilot: ARCTIC_PILOT_WORKSPACE` (or equivalent). |
| 5 | [`packages/shared-contracts/src/tours/index.ts`](packages/shared-contracts/src/tours/index.ts) | exports | Export new workspace module if split from `arctic.ts`. |
| 6 | **New** `apps/api/src/database/migrations/*-AddArcticPilotFormProfile.ts` | pattern: [`1777595800000-AddDenaliPilotFormProfile.ts`](apps/api/src/database/migrations/1777595800000-AddDenaliPilotFormProfile.ts) | Extend `CHECK` on `workspace_tour_themes.form_profile`, `workspace_tour_creation_presets.form_profile`, `tours.form_profile_snapshot`. |
| 7 | [`packages/shared-contracts/src/content/public-site.ts`](packages/shared-contracts/src/content/public-site.ts) | 17–24 | Update `CONTENT_WORKSPACE_DEFAULT_TOUR_PROFILE.arctic` from `"nature_trip"` → `"arctic_pilot"` if marketing workspace `arctic` should bind to the new profile. |
| 8 | [`apps/web/messages/en.json`](apps/web/messages/en.json) | ~1028–1034 | `settings.tourThemesFormProfileOption_arctic_pilot` (required by [`getTourFormProfileOptions`](packages/types/src/ui/tour-form-profile.config.ts)). |
| 9 | [`apps/web/messages/fa.json`](apps/web/messages/fa.json) | ~1035–1041 | Same FA label key. |

**Tier A count: 9 → exceeds threshold.**

#### Tier B — **Required only if** `arctic_pilot` uses **Denali rail** (like `denali_pilot` / `urban_event`) (+4 files → **13 total**)

| # | File | Line(s) | Change |
|---|------|---------|--------|
| 10 | [`apps/api/src/modules/tours/strategies/workspace.strategy.registry.ts`](apps/api/src/modules/tours/strategies/workspace.strategy.registry.ts) | 6–7, 24–28 | Add to `DENALI_STRATEGY_PROFILES`; routes to `DenaliWorkspaceStrategy`. |
| 11 | [`apps/web/src/features/tours/wizard/workspace-wizard.config.ts`](apps/web/src/features/tours/wizard/workspace-wizard.config.ts) | 25–28 | Add to `DENALI_WIZARD_PROFILES` (duplicate list — drift risk). |
| 12 | [`packages/shared-contracts/src/tours/workspace-ui-capabilities.ts`](packages/shared-contracts/src/tours/workspace-ui-capabilities.ts) | 27–46 | New profile branch or row if geo publish / service catalog / strip flags differ from `DEFAULT_UI_FLAGS`. |
| 13 | [`apps/api/src/modules/tours/strategies/workspace.strategy.builders.ts`](apps/api/src/modules/tours/strategies/workspace.strategy.builders.ts) | 40–45 | Only if trip-details validation phase must match `denali_pilot` (`before_canonical` vs `after_canonical`). |

#### Tier C — **Likely** for product-complete Arctic tenant (+2–4 files)

| # | File | Line(s) | Change |
|---|------|---------|--------|
| 14 | [`apps/web/src/features/tours/wizard/denali/denaliThemeFilter.ts`](apps/web/src/features/tours/wizard/denali/denaliThemeFilter.ts) | 28–31 | Add `arctic_pilot` to category → profile allowlists if theme picker should surface it. |
| 15 | [`apps/api/src/scripts/provision-denali-tenant.ts`](apps/api/src/scripts/provision-denali-tenant.ts) or new provision script | — | Seed template `base_profile`, themes, presets (ops; not runtime). |
| 16 | [`apps/api/openapi.json`](apps/api/openapi.json) | — | Regenerate after DTO enum expands (tooling). |
| 17 | [`packages/types/src/tour-form-profile.ts`](packages/types/src/tour-form-profile.ts) | 46–60 | Optional: `defaultTourFormProfileForTourType` if new commercial `TourType` maps to Arctic. |

#### Tier D — **Does not require edit** for basic `arctic_pilot` (data-driven today)

These adapt when Tier A is done (no profile string fork):

- [`apps/api/src/modules/tours/strategies/general.workspace.strategy.ts`](apps/api/src/modules/tours/strategies/general.workspace.strategy.ts) — default strategy for non-Denali profiles.
- [`apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts`](apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts) — `WorkspaceStrategyRegistry.resolve(profile)`.
- [`apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`](apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts) — strip via strategy + descriptor.
- [`apps/web/lib/workspace/workspace-capabilities.ts`](apps/web/lib/workspace/workspace-capabilities.ts) — derives from descriptor + `getTourWorkspaceDefinition` (default UI flags unless Tier B.12).
- [`apps/web/src/features/tours/wizard/profileRules/rules.ts`](apps/web/src/features/tours/wizard/profileRules/rules.ts) — loops `TOUR_FORM_PROFILE_VALUES` / descriptors (L241–247).
- API DTOs using `@IsIn(TOUR_FORM_PROFILE_VALUES_LIST)` — enum expands with types ([`create-tour.dto.ts`](apps/api/src/modules/tours/dto/create-tour.dto.ts) L130–137, settings theme/preset DTOs).
- Most `*.spec.ts` parity tests that iterate `TOUR_FORM_PROFILE_VALUES` — may need **expectation updates** but not new branching logic.

#### Tier E — **Still bypass registry** (unchanged by adding `arctic_pilot` unless explicitly migrated)

Not blocking profile registration, but still profile-string or Denali-engine coupled:

- [`apps/web/src/components/tours/TourForm.tsx`](apps/web/src/components/tours/TourForm.tsx) 268, 329–331, 395 — `denali_pilot` only.
- [`apps/web/src/features/tours/wizard/denali/validation/denaliWizardPublishReadiness.ts`](apps/web/src/features/tours/wizard/denali/validation/denaliWizardPublishReadiness.ts) 94.
- [`DenaliCreateTourWizard.tsx`](apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx) — Denali rule matrix, not capability-driven.
- Registration UI — tour-field policy, not workspace profile.

---

### Friction verdict

| Metric | Value |
|--------|--------|
| **Minimum manual files (classic `arctic_pilot`)** | **9** |
| **With Denali rail variant** | **13+** |
| **Threshold** | **> 5 → HIGH FRICTION** |
| **Workspace-agnostic?** | **No** for new workspace identity; **partial** for behavior given an existing profile row |

### What would make it lower-friction

1. **Single registry** in `@repo/shared-contracts`: `Record<TourFormProfile, WorkspaceBundle>` merging descriptor + workspace def + UI flags (eliminate `DENALI_*` duplicate lists).
2. **DB**: drop per-value `CHECK` in favor of application validation only, or one `form_profile` reference table.
3. **Codegen** from registry: `TOUR_FORM_PROFILE_VALUES`, i18n stubs, OpenAPI enum, migration `IN (...)` list.
4. **Parameterize** `ARCTIC_WORKSPACE` factory `createArcticWorkspace(profile: TourFormProfile)` to avoid one-file-per-profile copy-paste.

### Note on existing "Arctic" test case

The codebase already ships an **Arctic workspace definition** tied to **`nature_trip`**, not a free-form plug-in point. Introducing `arctic_pilot` validates that every new slug still pays the **Tier A** cost; it does not reuse a single `registerWorkspace("arctic", config)` API.

---

*End of Arctic workspace test audit.*

---

## Audit: Over-Engineering Check — WorkspaceUiCapabilityFlags + WorkspaceStrategy (2026-05-26)

### Abstraction stack (current)

```text
@repo/types
  getTourFormProfileDescriptor(profile)     ← data: strip, inactive groups, invariants

@repo/shared-contracts
  getTourWorkspaceDefinition(profile)       ← data: wizardMode, validation fns (3 profiles only)
  getWorkspaceUiCapabilityFlags(profile)    ← data: 3 flags (only denali_pilot differs)

apps/api — workspace.strategy.builders.ts   ← logic: buildValidationRules, buildPublishPolicy, …
  ↑ called by
  GeneralWorkspaceStrategy / DenaliWorkspaceStrategy (thin classes)
  ↑ selected by
  WorkspaceStrategyRegistry.resolve(profile)  ← 2-way fork (Denali vs General)

apps/web — parallel (no Registry)
  buildWizardConfig(profile)                  ← duplicate of API buildWizardConfig
  getCapabilitiesForProfile(profile)          ← 15-field projection + cache
```

**Depth:** 4–5 layers for the same `TourFormProfile` input, with **two independent web/API pipelines**.

---

### 1. Abstraction depth review

| Layer | LOC (approx) | Production consumers (API) | Production consumers (Web) |
|-------|----------------|---------------------------|--------------------------|
| `TourFormProfileDescriptor` | Large table | Via builders / asserts | `profileRules`, `fieldGroups`, strip |
| `TourWorkspaceDefinition` | 3 registry entries | Via builders | `buildWizardConfig` |
| `workspace.strategy.builders` | ~95 | **Indirect** via strategy | **Not imported** (web reimplements) |
| `WorkspaceUiCapabilityFlags` | ~48 | 3 call sites | 1 module (`workspace-capabilities`) |
| `IWorkspaceStrategy` + 2 classes | ~150 | 4 method families | **None** |
| `WorkspaceCapabilities` | ~170 | **None** | **3** (`tour-schema`, `tour-edit-client`, `TourCreateWizard`) |

#### `IWorkspaceStrategy` — five methods, actual usage

| Method | API production callers | Verdict |
|--------|------------------------|---------|
| `getValidationRules()` | `assert-create-tour-invariants.ts` L26–27 | **Used** |
| `getFieldStripRules()` | `assert-create-tour-invariants.ts`, `create-tour-form-profile-strip.ts` | **Used** |
| `getPublishPolicy()` | `assert-tour-publish-transition.ts` L23 | **Used** |
| `getRequiredSubmitFields()` | `assert-profile-required-fields-for-submit.ts` L69 | **Used** |
| `getWizardConfig()` | **None** (only `workspace.strategy.registry.spec.ts`) | **Dead on API** |

`GeneralWorkspaceStrategy` is a **pure delegate** to builders with constant options (`publishGeolocationCheck: null`, `appliesDenaliSingleDayLogisticsStrip: false`).  
`DenaliWorkspaceStrategy` adds **~25 lines** of real behavior: geo publish fn, single-day strip flag, `denali_pilot` submit field reader.

#### `WorkspaceUiCapabilityFlags` — three fields

| Field | Set for | Consumers |
|-------|---------|-----------|
| `requiresGeoPublish` | `denali_pilot` only | API publish policy, web `requiresGeoPublish` |
| `appliesDenaliSingleDayLogisticsStrip` | `denali_pilot` only | API strip via `DenaliWorkspaceStrategy` |
| `availableServices` | `denali_pilot` catalog | Web capabilities only; **no UI consumer yet** |

**Assessment:** Small and **lean as a table**. Slight overlap with what `DenaliWorkspaceStrategy` already injects into `buildPublishPolicy` / `buildFieldStripRules` — same facts, two modules.

#### `WorkspaceCapabilities` (web) — speculative surface

Of **15** exported fields, production web code uses only:

- `usesDenaliWizardShell` — `tour-edit-client.tsx`, `TourCreateWizard.tsx`
- `requiresGeoPublish` — `tour-schema.ts`

Fields such as `canAddTransport`, `canAddMeals`, `allowsMountainOverviewFields`, `availableServices`, `hasWorkspaceValidation`, etc. appear **only** in `workspace-capabilities.ts` and its spec — **zero production UI imports** (grep 2026-05-26). This is **forward-looking API surface**, not lean minimal API.

---

### 2. Lean or bloated?

**Verdict: Transitionally bloated — core logic is lean; wrappers and mirrors are not.**

| Lean (keep) | Bloated / redundant (flatten candidates) |
|-------------|------------------------------------------|
| `getTourFormProfileDescriptor` | `GeneralWorkspaceStrategy` class (stateless pass-through) |
| `workspace.strategy.builders.ts` | `IWorkspaceStrategy` interface + 5 DTO sub-interfaces if only 2 behavioral forks exist |
| `getWorkspaceUiCapabilityFlags` as a **small** shared table | Duplicate `buildWizardConfig` in `apps/web/.../workspace-wizard.config.ts` |
| `DenaliWorkspaceStrategy` behavior (could be 2 functions) | Full `WorkspaceCapabilities` object until call sites exist |
| | `getWizardConfig()` on strategy (unused on API) |
| | `WorkspaceStrategyRegistry` class indirection for a **binary** branch |

**Ratio:** ~95 LOC of real builder logic vs ~320+ LOC of interfaces, classes, registry, web mirror, and unused capability fields.

---

### 3. Could simpler props / functions replace StrategyRegistry?

**Yes, for current behavior.**

Today there are only **two** behavioral families:

1. **Denali-rail profiles** (`denali_pilot`, `urban_event`) — shared `DENALI_WORKSPACE`, differing geo/strip/submit nuances.
2. **Everyone else** — `GeneralWorkspaceStrategy` → builders with null/false options.

Equivalent without classes:

```typescript
// Pseudocode — same behavior as registry
export function resolvePublishPolicy(profile: TourFormProfile) {
  const ui = getWorkspaceUiCapabilityFlags(profile);
  return buildPublishPolicy(profile, {
    publishGeolocationCheck: ui.requiresGeoPublish
      ? (td) => checkDenaliPilotPublishGeolocationZones(td)
      : null,
  });
}

export function resolveFieldStripRules(profile: TourFormProfile) {
  return buildFieldStripRules(profile, {
    appliesDenaliSingleDayLogisticsStrip:
      getWorkspaceUiCapabilityFlags(profile).appliesDenaliSingleDayLogisticsStrip,
  });
}

export function resolveValidationRules(profile: TourFormProfile) {
  return buildValidationRules(profile);
}

export function resolveRequiredSubmitFields(profile: TourFormProfile) {
  return profile === "denali_pilot"
    ? buildDenaliPilotRequiredSubmitFields(profile)
    : buildRequiredSubmitFields(profile);
}
```

Call sites would import **functions** instead of `WorkspaceStrategyRegistry.resolve(profile).getX()`.

**Standard props** fit the **web** side better than Nest strategy classes:

```typescript
// Parent already has template.baseProfile
const caps = getCapabilitiesForProfile(profile);
<RegisterForm availableServices={caps.availableServices} />
```

No need for web to know `IWorkspaceStrategy` exists. One shared `WorkspaceProfileBundle` type in `@repo/shared-contracts` could back both API asserts and React props.

---

### 4. Unnecessary abstractions to flatten (priority order)

| Priority | Abstraction | Action |
|----------|-------------|--------|
| **P0** | `GeneralWorkspaceStrategy` | Remove; call `build*` directly with default options. |
| **P0** | `getWizardConfig()` on `IWorkspaceStrategy` | Remove from interface **or** wire API to use it; today web/API duplicate `buildWizardConfig`. |
| **P1** | `WorkspaceStrategyRegistry` class | Replace with `resolvePublishPolicy(profile)` etc., or single `getWorkspaceContext(profile)` struct. |
| **P1** | Web `buildWizardConfig` duplicate | Import builders from shared package or export one `getWorkspaceProfileBundle` from `@repo/shared-contracts`. |
| **P2** | `WorkspaceCapabilities` (15 fields) | Shrink to fields **actually used** (`usesDenaliWizardShell`, `requiresGeoPublish`, `availableServices`) until migrations land; or generate from bundle. |
| **P2** | `WorkspaceUiCapabilityFlags` vs strategy hooks | Merge into one `WorkspaceProfileExtensions` record on `TourWorkspaceDefinition` to avoid two denali_pilot tables. |
| **P3** | Five sub-interfaces in `workspace.strategy.interface.ts` | Collapse to one `WorkspaceContext` type if classes go away; keep only if team wants Nest-style documentation boundaries. |
| **Keep** | `workspace.strategy.builders.ts` | This **is** the implementation; not over-engineered. |
| **Keep** | `DenaliWorkspaceStrategy` logic (as functions) | Real profile-specific behavior; not redundant. |

**Do not flatten:** `getTourFormProfileDescriptor`, Denali rule engine, or registration/tour-field policies — different concerns.

---

### 5. Final verdict

| Question | Answer |
|----------|--------|
| Is the architecture **lean**? | **At the builder/descriptor core — yes.** |
| Is it **bloated** overall? | **Yes at the boundaries** — duplicate config pipelines, unused strategy method, speculative web capability fields, class/registry ceremony for a 2-branch matrix. |
| Rarely used abstractions? | `IWorkspaceStrategy.getWizardConfig`, most `WorkspaceCapabilities` fields, `WorkspacePublishPolicy.allowedLifecycleTransitions` (mostly identical fallback). |
| Same behavior with simpler props? | **Yes** — one `getWorkspaceProfileBundle(profile)` in shared-contracts + thin web helpers + function-based API asserts. |
| Over-engineering severity | **Moderate** — justified as Phase 2 migration scaffolding (see `workspace.strategy.interface.ts` L111–114), but **technical debt** if left without collapsing layers. |

**One-line summary:** Keep the **builders and descriptor**; flatten the **Strategy class hierarchy**, **merge UI flag tables**, and **dedupe web `buildWizardConfig`** before adding more workspaces.

---

*End of over-engineering audit.*
