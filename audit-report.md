# Audit Report

---

## Appendix: `tour-wizard-template-builder-form.ts` vs DB schema vs `DenaliCanonicalTemplateData`

**Analyzed:** 2026-06-01  
**Source:** `apps/web/lib/validation/tour-wizard-template-builder-form.ts`  
**DB:** `workspace_tour_wizard_templates` (`WorkspaceTourWizardTemplateEntity`)  
**Type authority:** `packages/types/src/denali/denaliTemplateSchema.ts`, `denaliCanonicalTemplateDataSchema.ts`

### 1. Database columns vs builder payload

| DB column (`workspace_tour_wizard_templates`) | TypeORM / TS type | Builder module role |
|---------------------------------------------|-------------------|---------------------|
| `canonical_data` (jsonb, default `{}`) | `DenaliCanonicalTemplateData` | Read: `unpackCanonicalTemplateToFormValues(canonical, fieldPaths)` → flat `canonicalData[storagePath]` seeds. Write: `packTemplateCanonicalForPersist` → nested Layer A → `buildTourWizardTemplatePayloadFromForm(..., { canonicalLayerA })` → PATCH body `canonicalData`. |
| `field_rules_overlay` (jsonb, default `{}`) | `Record<string, unknown>` | Separate from canonical type. Read/write: `buildTourWizardTemplateBuilderDefaults` / `buildTourWizardTemplatePayloadFromForm` (overlay rows only; empty visibility/required omitted). |
| `step_overrides` (jsonb) | `WorkspaceTourWizardStepOverrides` | **Not touched** by builder-form.ts (deprecated; Denali path uses canonical only). |
| `base_profile`, `preset_id`, `wizard_contract_version`, `form_profile_version`, timestamps | scalar / meta | Not transformed by builder-form.ts. |

**Verdict (DB ↔ type):** Postgres stores **unconstrained jsonb**; the **contract** is application-layer only. The entity annotation `canonicalData!: DenaliCanonicalTemplateData` matches the TS definition (`Partial<DenaliCanonicalTourModel>` nested partials). **No column-level JSON schema in DB** — alignment depends on API `parseDenaliCanonicalTemplateDataOrThrow` / `resolveStoredTemplateCanonical` + client `validateDenaliCanonicalTemplateData`.

### 2. Wire shape: builder internal vs persisted JSONB

The builder uses **two representations**:

1. **RHF / form (`TourWizardTemplateBuilderFormValues.canonicalData`):** flat keys with bracket notation, e.g. `canonicalData[program.itinerary]`, driven by `DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS` (via `fieldPaths`).
2. **Persisted `canonical_data`:** nested **Layer A** object (`category`, `program: { itinerary: [...] }`, etc.) produced by `packCanonicalFormValuesToTemplateData` / `denaliCanonicalFromForm`.

`readCanonicalNestedValue` / `writeCanonicalNestedValue` implement dot-path ↔ nested JSON mapping. **Matches** `DenaliCanonicalTemplateData` tree shape when `canonicalLayerA` is passed through on save (avoids re-packing flat seeds only).

### 3. `DenaliCanonicalTemplateData` vs Zod vs builder pack pipeline

| Layer | Definition | Strictness |
|-------|------------|------------|
| TS type | `Partial<{ [K in keyof DenaliCanonicalTourModel]: ... }>` | Compile-time; allows any declared top-level key with partial nested objects. |
| Zod | `denaliCanonicalTemplateDataSchema` (`.strict()` per slice) | Save-time; unknown top-level/nested keys **rejected** (`validateDenaliCanonicalTemplateData`). |
| Top-level allow-list | `DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS` | `sanitizeDenaliCanonicalTemplateData` / `resolveStoredTemplateCanonical` reject fossils **before** Zod. |
| Builder assert | `assertPackedCanonicalTemplateData` | Client-side throw on invalid packed payload (same Zod). |

**Verdict (type ↔ Zod):** **Aligned** for keys in `DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS`. Type is looser at compile time; runtime authority is Zod + fossil guard on API read/write.

### 4. Coverage gaps (builder paths vs canonical type)

Documented in `tour-wizard-template-semantic-drift.spec.ts`:

| Category | Paths | DB / type | Builder left panel |
|----------|-------|-----------|-------------------|
| **Phantom** | `eventVariant` | **Not** in `DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS` or Zod schema — **never persisted** in `canonical_data` if only set on left panel | Exposed in section groups |
| **Backend-only top-level** | `meetingPoint`, `gatheringPoint`, `publishStatus`, `startPointLocationText` | In type + Zod | Omitted from overlay seeds; persist via **preview** `denaliCanonicalFromForm` when classified |
| **Backend-only nested** | `pricing.paymentMode`, `transport.transportNotes`, `transport.seatPreference` | In Zod (deprecated fields) | Ghost paths — preview/hydration only |
| **Overlay-only composites** | `program.itinerary`, `photos`, `gatheringPoints`, `participants.gearItems`, … | In type + Zod | Left panel hint-only; values from **preview** merge |

**Verdict:** DB schema **can** hold full `DenaliCanonicalTemplateData`; the builder **does not** round-trip all type keys through the left panel alone. Full parity requires preview classified save (`packTemplateCanonicalForPersist` + `canonicalLayerA`).

### 5. Functions ↔ persistence contract

| Function | Output shape | Matches `DenaliCanonicalTemplateData`? |
|----------|--------------|----------------------------------------|
| `unpackCanonicalTemplateToFormValues` | Flat seeds for `fieldPaths` only | Partial read — not full document |
| `packCanonicalFormValuesToTemplateData` | Nested from flat dot keys | Yes, if keys ⊆ Layer A vocabulary |
| `buildTemplateCanonicalDataForSave` / `packTemplateCanonicalForPersist` | Nested; preview wins program/itinerary | Yes, when `tourType` set; else left-panel only |
| `buildTourWizardTemplatePayloadFromForm` | `{ fieldRulesOverlay, canonicalData }` | Canonical: yes with `canonicalLayerA`; overlay: separate column |
| `assertPackedCanonicalTemplateData` | Validated `DenaliCanonicalTemplateData` | **Authoritative** client check |

### 6. Registry vs overlay in this file

- `STORAGE_PATH_TO_DEFINITION` maps overlay storage paths → `DENALI_FIELD_DEFINITIONS` (`toDenaliTemplateStoragePath(canonicalPath)`).
- Composite kinds (`itinerary`, `photos`, `gatheringPoints`, …) are **excluded** from scalar seed widgets (`DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS`).
- This file does **not** use `DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS` directly; callers pass `fieldPaths` from section groups.

### 7. Summary verdict

| Question | Answer |
|----------|--------|
| Does DB `canonical_data` column match `DenaliCanonicalTemplateData`? | **Structurally yes** (jsonb + TS/Zod contract). **No DB enforcement.** |
| Does `tour-wizard-template-builder-form.ts` always write a valid `DenaliCanonicalTemplateData`? | **Only when** save uses `canonicalLayerA` from `packTemplateCanonicalForPersist` and API/client validation pass. Left-panel-only save can persist **partial** canonical (allowed by deep-partial Zod). |
| Silent mismatch risk? | **Yes** for `eventVariant` (UI path not in canonical JSONB). **Mitigated** for preview fields via `canonicalLayerA`. Fossil top-level keys rejected on API `resolveStoredTemplateCanonical`. |

### 8. Recommendations (recorded; not implemented here)

1. Remove or relocate `eventVariant` from builder seed paths (classify as rule-model-only, not `canonical_data`).
2. Add `meetingPoint` (and other backend-only top-level keys) to overlay list **or** document preview-only persist in operator guide.
3. Optional DB check constraint or migration comment documenting jsonb contract version (`wizard_contract_version`).

**Cross-references:** `apps/web/lib/validation/tour-wizard-template-semantic-drift.spec.ts`, `reports/hybrid-wizard-architecture-hole-audit.md`, `packages/types/src/denali/denali-canonical-template-keys.ts`.
---

## Composite-Loss Audit — Settings Preview Save / Reload (2026-06-01)

**Procedure:** `pnpm --filter web audit:settings-composite-loss` (`apps/web/scripts/audit-settings-composite-loss.ts`)

**Generated:** 2026-06-01T01:46:46.572Z

**Save adapter:** canonicalDataFromWizardForm → @repo/types/denali denaliCanonicalFromForm (Settings builder submit)

**Note:** Reload simulated by orchestrateDenaliWizardFromTemplate on saved canonical (same as settings page re-open). API persists full canonicalData replacement (no server-side field merge).

### Scenarios

| Scenario | Pass | Detail |
|----------|------|--------|
| save_adapter_exports_gallery_photos | yes | canonicalDataFromWizardForm includes gallery photos |
| itinerary_only_edit_save_reload | yes | Itinerary-only: category/title preserved on save; itinerary updated; reload form matches |
| photos_only_edit_save_reload | yes | Photos-only: siblings preserved; photo edit persisted through save/reload form |

### Fingerprints (itinerary-only)

| Stage | category | title | photos (canonical) | photos (form reload) | day1 |
|-------|----------|-------|------------------|----------------------|------|
| baseline | mountain | __COMPOSITE_BASELINE_TITLE__ | 2 | — | __COMPOSITE_BASELINE_DAY1__ |
| after save | mountain | __COMPOSITE_BASELINE_TITLE__ | 2 | — | __COMPOSITE_EDITED_ITINERARY_ONLY__ |
| after reload (form) | mountain | __COMPOSITE_BASELINE_TITLE__ | — | 2 | __COMPOSITE_EDITED_ITINERARY_ONLY__ |

### Fingerprints (photos-only)

| Stage | category | title | photos | day1 |
|-------|----------|-------|--------|------|
| baseline | mountain | __COMPOSITE_BASELINE_TITLE__ | 2 (baseline-a.jpg) | __COMPOSITE_BASELINE_DAY1__ |
| after save | mountain | __COMPOSITE_BASELINE_TITLE__ | 2 (__COMPOSITE_EDITED_PHOTO_ONLY__.jpg) | __COMPOSITE_BASELINE_DAY1__ |
| after reload (form) | mountain | __COMPOSITE_BASELINE_TITLE__ | 2 (__COMPOSITE_EDITED_PHOTO_ONLY__.jpg) | __COMPOSITE_BASELINE_DAY1__ |

### Verdict (requested fields)

| Edit scope | category | title | photos | itinerary |
|------------|----------|-------|--------|-----------|
| Itinerary-only → save (canonical) | mountain | __COMPOSITE_BASELINE_TITLE__ | preserved (2) | updated (__COMPOSITE_EDITED_ITINERARY_ONLY__) |
| Itinerary-only → reload (preview form) | mountain | __COMPOSITE_BASELINE_TITLE__ | preserved (2) | updated (__COMPOSITE_EDITED_ITINERARY_ONLY__) |
| Photos-only → save / reload | mountain | __COMPOSITE_BASELINE_TITLE__ | updated (__COMPOSITE_EDITED_PHOTO_ONLY__.jpg) | preserved |

**Overall:** **PASS** — single-field edits (itinerary-only, photos-only) do not null category, title, or sibling composites through Settings save → reload.

**Artifact:** `apps/web/reports/settings-composite-loss.json`
---
---

## Concurrency Audit — Settings Template Builder Save (2026-06-01)

**Procedure:** `pnpm --filter web audit:template-builder-save-concurrency` (`apps/web/scripts/audit-template-builder-save-concurrency.ts`)

**Generated:** 2026-06-01T01:52:51.507Z

**Save entrypoint:** `TourWizardTemplateBuilderForm.submit / submitSave → applyClientValidation → buildTourWizardTemplatePayloadFromForm → useUpdateTourWizardTemplate.mutateAsync → PATCH /api/settings/tour-wizard-template`

### Client guards (static)

| Guard | Present |
|-------|---------|
| `submit` checks `isSavingRef` + `isPending` before PATCH | yes |
| `isSaving` state + ref for save mode | yes |
| Save via `handleSubmit(submitSave)` | yes |
| Save/Publish disabled while `isSaveBusy` | yes |
| TanStack `useMutation` dedupes concurrent `mutateAsync` | **no** |
| In-flight abort / If-Match version token | **no** |

### API persistence

| Behavior | Value |
|----------|-------|
| `field_rules_overlay` server merge | **no (full replace)** |
| `field_rules_overlay` full replace on PATCH | yes |
| `canonical_data` full replace on PATCH | yes |

**Payload per save:** Full `fieldRulesOverlay` snapshot from current RHF overlay form + full `canonicalData` from wizard form (same request).

### Double-save simulation

Without ref guard (legacy): max concurrent PATCH handlers **2**
With `isSavingRef` guard (current `submit`): second call ignored **yes**, max concurrent **1**

### Overlay race scenarios (API full-replace; if concurrent PATCHes bypass client lock)

| Scenario | Finishes first | Lost edits | Pass |
|----------|----------------|------------|------|
| Save A (title→hidden) slow; Save B (program→required) fast | save_b | program.shortDescription (expected visibility=active required=required, got visibility=active required=optional) | **no** |
| Save A fast; Save B slow (reverse ordering) | save_a | title (expected visibility=hidden required=optional, got visibility=always required=optional) | **no** |

### Static findings

- No `handleSave` symbol; save path is `submitSave` → `submit("save")` from `handleSubmit(submitSave)` and Publish `onClick`.
- `submit("save")` returns early when `isSavingRef.current || updateMutation.isPending` (synchronous ref lock).
- Save/Publish use `disabled={isSaveBusy}` where `isSaveBusy = isSaving || updateMutation.isPending`.
- `useUpdateTourWizardTemplate` uses bare `useMutation` + `mutateAsync` (no dedupe queue).
- Each save builds full `fieldRulesOverlay` + full `canonicalData` snapshots (not field deltas).
- `TourWizardTemplateSettingsService.updateForWorkspace` replaces entire `field_rules_overlay` and `canonical_data` JSONB columns.
- Unlocked double-save simulation: max concurrent = 2. With ref guard: started=1, max concurrent = 1.
- If two PATCHes complete, overlay race scenarios show last-write-wins loss on the non-winning snapshot.

### Verdict

**PASS:** `submit` / `submitSave` locks via `isSavingRef` + `isSaveBusy`; rapid double Save does not start overlapping PATCHes. API still full-replaces `field_rules_overlay` and `canonical_data` — concurrent PATCHes (if any) would be last-write-wins (see overlay race table).

**Artifact:** `apps/web/reports/template-builder-save-concurrency.json`

## Registry-Defaults Leakage Audit — `orchestrateDenaliWizardFromTemplate` (2026-06-01)

**Procedure:** `pnpm --filter web audit:registry-defaults-leakage` (`apps/web/scripts/audit-registry-defaults-leakage.ts`)

**Generated:** 2026-06-01T01:46:59.550Z

**Entrypoint:** `orchestrateDenaliWizardFromTemplate → denaliTemplateOrchestratorFactory.createDraftFromTemplate`

**Pipeline:** resolveStoredTemplateCanonical → tryHydrateCanonicalTemplate( patch, resetWizardToRegistryDefaults() ) → denaliCanonicalToForm(merged, existingForm) → normalize → finalize → pruneDenaliWizardFormToRegistry

**Registry RHF paths:** 57

### Scenarios

| Scenario | Pass | Detail |
|----------|------|--------|
| Empty {} canonical → registry default shell (no stale merge) | **yes** | roots=basicInfo,programNature,transport,pricingPayment,participantRequirements,policies,photosData,tripDetails; ghosts=0 |
| Sparse legacy canonical merges onto defaults (title preserved, no ghosts) | **yes** | title=__OLD_REGISTRY_TEMPLATE_TITLE__; ghosts=— |
| New registry paths absent in old canonical receive fresh defaults | **yes** | photosData.photos=default; tripDetails.logistics.gatheringPoints=default; tripDetails.metrics.elevationGain=default; participantRequirements.gearItems=default; programNature.itinerary=default |
| Stale keys injected via defaultValues are stripped by prune (not merged forward) | **yes** | ghost in defaults=true; in orchestrated=false; after prune=false |
| Fossil canonical keys fail resolve before hydration (no stale JSON merge) | **yes** | tripDetails: Invalid canonical path "tripDetails" — use "overview.peakHeight" in canonicalData JSON instead. |
| Hydrated output is registry-pruned shell (DENALI_ROOTS only, no extra top-level keys) | **yes** | roots=basicInfo,programNature,transport,pricingPayment,participantRequirements,policies,photosData,tripDetails |
| Legacy template hydration defines ≥ fresh prune paths (registry backfill, not stale shrink) | **yes** | sparse=22, freshPrune=18 of 57 registry paths |

### Synthetic new-registry paths (absent in sparse legacy canonical)

All match `resetWizardToRegistryDefaults()`: **yes**

| Path | Matches fresh default |
|------|----------------------|
| `photosData.photos` | yes |
| `tripDetails.logistics.gatheringPoints` | yes |
| `tripDetails.metrics.elevationGain` | yes |
| `participantRequirements.gearItems` | yes |
| `programNature.itinerary` | yes |

### Stale `defaultValues` ghost probe

Ghost injected in defaults: **yes**

Ghost survives orchestration: **no**

Ghost after manual prune: **no**

### Verdict

**PASS:** Old/sparse templates hydrate via `resetWizardToRegistryDefaults()` → canonical merge → `denaliCanonicalToForm(existingForm)` → prune. New registry fields receive current defaults; stale non-registry keys are not carried forward. Empty canonical yields a registry-default shell, not a stale JSON merge.

**Artifact:** `apps/web/reports/registry-defaults-leakage.json`
---

## Failure-Resilience Audit — Corrupt Template Hydration (2026-06-01)

**Procedure:** `pnpm --filter web audit:wizard-hydration-failure-resilience` (`apps/web/scripts/audit-wizard-hydration-failure-resilience.ts`)

**Generated:** 2026-06-01T01:47:02.206Z

**Mock:** Injected tryHydrateCanonicalTemplate return { formValues: partial corrupt + ghost root }; factory post-pipeline is authoritative before client sees instantiate payload.

### Runtime scenarios

| Scenario | Pass | Detail |
|----------|------|--------|
| try_hydrate_null_registry_fallback | yes | Empty canonical → tryHydrate null → factory uses registry defaults + prune |
| mock_corrupt_try_hydrate_factory_prune | yes | Corrupt partial hydrate healed to full DENALI_ROOTS; registry title preserved; ghost root stripped |
| invalid_canonical_factory_rejects | yes | Zod canonical validation fails before hydrate (no corrupt form emitted) |
| client_rejects_failed_instantiate | yes | success:false → factoryHydrationRejected; submit rail unreachable |
| client_rejects_missing_form_envelope | yes | Missing draftState.form → rejected; wizard not ready |
| hypothetical_empty_form_object_submit_blocked | yes | If API leaked {} form, wizard would render but submit guards block empty canonical |
| factory_empty_canonical_submit_guard | yes | Registry-default factory form blocked by isWizardFormCanonicalEmpty on submit |

### WorkspaceTourWizard.tsx static guards

| Guard | Present | Detail |
|-------|---------|--------|
| factory_hydration_rejected_early_return | yes | Dedicated rejected UI before main wizard shell |
| rejected_testid_banner | yes | data-testid for factory rejection card |
| wizard_form_ready_gate | yes | Submit rail gated on hydration applied |
| visible_steps_empty_without_ready | yes | No visible steps until wizardFormReady |
| submit_canonical_empty_guard | yes | handleSubmit blocks empty canonical export |
| no_try_hydrate_in_wizard | yes | Wizard does not call tryHydrateCanonicalTemplate directly (factory/instantiate only) |
| orchestration_error_root | yes | Preset/clear orchestration failures surface root error |
| hydration_parity_throw | yes | Parity mismatch throws HydrationParityError in hydrate effect (ErrorBoundary dependent) |
| client_merge_no_registry_prune | yes | Client merge path finalizes but does not re-prune registry (relies on factory-pruned instantiate payload) |

**Overall:** **PASS** — reject or submit-guard contains corrupt hydration; no silent submit of mocked corrupt partial state

**Artifact:** `apps/web/reports/wizard-hydration-failure-resilience.json`
---
---

## API Injection Audit — PATCH `tour-wizard-template` / `DenaliCanonicalTemplateData` (2026-06-01)

**Procedure:** `pnpm --filter @apps/api audit:template-api-injection` (`apps/api/src/scripts/audit-template-api-injection.ts`)

**Generated:** 2026-06-01T01:51:19.689Z

**Endpoint:** `PATCH /api/v2/settings/tour-wizard-template`

**Validation chain:** UpdateWorkspaceTourWizardTemplateDto (@IsObject) → validateWorkspaceWizardTemplatePayload → validateDenaliCanonicalTemplateData → denaliCanonicalTemplateDataSchema.safeParse → sanitizeDenaliCanonicalTemplateData on success

**DTO layer:** class-validator does not validate enums, numeric bounds, or nested keys on canonicalData; only JSON object shape.

### Injection cases (validator + service.updateForWorkspace)

| Case | Expect reject | Validator | Service PATCH | Saved | Pass |
|------|---------------|-----------|---------------|-------|------|
| Positive control: valid partial canonical | no | accept | accept | yes | **yes** |
| Invalid duration enum string (single_day) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid duration type (numeric -1) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid category enum (volcano) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Negative capacityMax | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Zero capacityMax (min 1) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| program.difficultyLevel below min (0) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| program.hikingHoursApprox negative | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid transport.mode enum | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid publishStatus enum | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Fossil tripDetails root key | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Unknown nested program key (strict) | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid fieldRulesOverlay.visibility enum | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Unparsable startDateTime string | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |
| Invalid program.themeIds UUID | yes | **reject** | **reject** (VALIDATION_FAILED) | no | **yes** |

### Live HTTP PATCH probe

Skipped — Set AUDIT_PATCH_BEARER_TOKEN and AUDIT_TENANT_HOST for live PATCH probe

### Verdict

**PASS:** Invalid semantic payloads are rejected by `validateDenaliCanonicalTemplateData` (strict Zod); `TourWizardTemplateSettingsService.updateForWorkspace` returns `VALIDATION_FAILED` and does not persist. Nest DTO only checks `@IsObject()` — semantic gate is server-side Zod, not class-validator.

**Artifact:** `apps/api/reports/template-api-injection.json`

## Isolation-Integrity Audit — Template Instantiate Cross-Tenant (2026-06-01)

**Procedure:** `pnpm --filter @apps/api audit:template-instantiate-isolation` (`apps/api/src/scripts/audit-template-instantiate-isolation.ts`)

**Generated:** 2026-06-01T01:47:08.710Z

**Endpoint:** `POST /api/v2/settings/tour-wizard-template/instantiate`

**Client templateId accepted:** **no**

**Repository lookup:** findTourWizardTemplateByWorkspace(workspaceId) — unique index on workspace_id

### Scenarios

| Scenario | Pass | Detail |
|----------|------|--------|
| POST instantiate exposes only seedDraft query param (no client templateId) | **yes** | SettingsTourWizardTemplateController.instantiateTemplate → updateForWorkspace({ seedDraft }); template row resolved server-side by effective tenant workspace only. |
| WorkspaceSettingsRepositoryPort has no find-by-template-id API | **yes** | Only findTourWizardTemplateByWorkspace(workspaceId) exists; lookup is workspace-scoped. |
| Tenant A instantiate hydrates only Tenant A canonical (not B) | **yes** | payload.workspaceId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, templateId=11111111-1111-4111-8111-111111111111, hydratedTitle=__TENANT_A_TEMPLATE_SECRET__ |
| Tenant A instantiate without configured row → NotFound (no fallback to B) | **yes** | NotFoundException |
| Direct orchestrator call with Tenant B canonical under Tenant A ids (control — no tenant gate) | **yes** | Orchestrator is in-memory only; isolation must be enforced in API service + repository. |
| Service path never loads Tenant B row when effective tenant is A | **yes** | Instantiate always uses findTourWizardTemplateByWorkspace(effectiveTenantId) result. |

### DB probe (`workspace_tour_wizard_templates`)

Skipped — SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string

### Verdict

**PASS:** Tenant A cannot hydrate from Tenant B via the instantiate API. The service resolves the template row only by effective workspace id; missing row returns `NotFoundException`. The orchestrator does not perform tenant checks — callers must not pass foreign canonical payloads.

| Layer | Tenant boundary |
|-------|-----------------|
| `TourWizardTemplateSettingsService.instantiateForWorkspace` | **yes** |
| `TemplateOrchestratorService` / `DenaliTemplateOrchestratorFactory` | **no (by design)** |

**Artifact:** `apps/api/reports/template-instantiate-isolation.json`
---

## Schema-Resilience Audit — `denaliCanonicalTemplateDataSchema` / `resolveStoredTemplateCanonical` (2026-06-01)

**Procedure:** `pnpm --filter @apps/api audit:template-schema-resilience` (`apps/api/src/scripts/audit-template-schema-resilience.ts`)

**Generated:** 2026-06-01T01:48:11.067Z

**Schema:** `denaliCanonicalTemplateDataSchema (strict deep-partial Zod in @repo/types/denali)`

**Resolver:** resolveStoredTemplateCanonical → fossil/top-level gate → templateToCanonical → validateDenaliCanonicalTemplateData → denaliCanonicalTemplateDataSchema.safeParse

**Orchestrator gate:** DenaliTemplateOrchestratorFactory.createDraftFromTemplate calls resolveStoredTemplateCanonical first; hydration runs only when resolved.ok

**Service instantiate gate:** TourWizardTemplateSettingsService.resolveValidatedCanonicalDataOrThrow before templateOrchestrator.createDraftFromTemplate

### Broken-payload matrix

| Case | Expect reject | Resolver | Orchestrator | Failure kind | Pass |
|------|---------------|----------|--------------|--------------|------|
| Positive control: valid partial canonical | no | accept | success | — | **yes** |
| Root canonicalData is array | yes | **reject** | **fail** | canonical_validation | **yes** |
| duration numeric instead of enum string | yes | **reject** | **fail** | canonical_validation | **yes** |
| duration invalid enum (single_day) | yes | **reject** | **fail** | canonical_validation | **yes** |
| category invalid enum (volcano) | yes | **reject** | **fail** | canonical_validation | **yes** |
| capacityMax string instead of int | yes | **reject** | **fail** | canonical_validation | **yes** |
| transport.mode deep-nested invalid enum | yes | **reject** | **fail** | canonical_validation | **yes** |
| program.themeIds invalid UUID element | yes | **reject** | **fail** | canonical_validation | **yes** |
| program.difficultyLevel string instead of number | yes | **reject** | **fail** | canonical_validation | **yes** |
| program.itinerary[].day string instead of int | yes | **reject** | **fail** | canonical_validation | **yes** |
| photos[].mimeType invalid enum pattern | yes | **reject** | **fail** | canonical_validation | **yes** |
| publishStatus invalid enum | yes | **reject** | **fail** | canonical_validation | **yes** |
| Unknown top-level key (strict schema) | yes | **reject** | **fail** | canonical_validation | **yes** |
| Unknown nested program key (strict) | yes | **reject** | **fail** | canonical_validation | **yes** |
| Fossil tripDetails root (pre-Zod fossil gate) | yes | **reject** | **fail** | canonical_validation | **yes** |
| startDateTime unparseable ISO string | yes | **reject** | **fail** | canonical_validation | **yes** |

### Service `instantiateForWorkspace` probe (broken row)

Broken canonical rejected before orchestrator: **yes** (TEMPLATE_CANONICAL_DATA_CORRUPT)

Orchestrator invoked: **no**

### Verdict

**PASS:** `resolveStoredTemplateCanonical` rejects malformed canonical JSON (wrong types, invalid enums, strict unknown keys, fossils) before `DenaliTemplateOrchestratorFactory` hydrates. Factory returns `canonical_validation` failure; API instantiate throws `TEMPLATE_CANONICAL_DATA_CORRUPT` without calling orchestrator.

**Artifact:** `apps/api/reports/template-schema-resilience.json`
---
---

## Ghost-Field Audit — `canonical_data` vs Registry / `pruneDenaliWizardFormToRegistry` (2026-06-01)

**Procedure:** `pnpm --filter @apps/api audit:template-canonical-ghost-fields` (`apps/api/src/scripts/audit-template-canonical-ghost-fields.ts`)

**Generated:** 2026-06-01T01:50:40.743Z

**Templates scanned:** 3 (0 non-empty `canonical_data`; production rows empty — synthetic fixture exercised)

**Registry definition:** DENALI_FIELD_DEFINITIONS canonical paths → storage (`toDenaliTemplateStoragePath`) + ZOD_KIND_ARRAY_ELEMENT_KEYS + location object keys; compared to live JSONB.

### Aggregate

| Kind | Count | Paths |
|------|-------|-------|
| Registry ghost keys (nested/top-level not on allow-map) | 3 | __ghostTopLevel, photos[].__ghostPhotoField, program.itinerary[].__ghostItineraryRow |
| Discarded top-level fossils (allow-list strip) | 0 | — |
| Paths lost after factory hydrate → prune → canonical export | 1 | <orchestration_failed> |

### Per template

| Template | Profile | Keys | Registry ghosts | Zod/top-level fossils | Prune round-trip losses |
|----------|---------|------|-----------------|----------------------|-------------------------|
| `4931f36a…` | urban_event | 0 | — | — | — |
| `768660fa…` | denali | 0 | — | — | — |
| `5ee26021…` | denali | 0 | — | — | — |

### Synthetic probes (registry + prune)

| Probe | Registry ghosts | Prune losses | Notes |
|-------|-----------------|--------------|-------|
| Deliberate smuggled keys in canonical_data | __ghostTopLevel, photos[].__ghostPhotoField, program.itinerary[].__ghostItineraryRow | <orchestration_failed> | Registry ghosts: __ghostTopLevel, program.itinerary[].__ghostItineraryRow, photos[].__ghostPhotoField |
| Valid rich canonical → hydrate → pruneDenaliWizardFormToRegistry → export | — | — | Measures registry-addressable fields dropped by prune pipeline (category/title/photos/itinerary should survive) |

**Pass (stored DB rows clean):** **yes**

**Finding:** 3 saved template(s) scanned; all have empty `canonical_data` — no live registry/Zod ghosts. Synthetic smuggled keys (`__ghostTopLevel`, `photos[].__ghostPhotoField`, `program.itinerary[].__ghostItineraryRow`) are outside registry allow-map; factory rejects them before prune. Clean rich canonical → `pruneDenaliWizardFormToRegistry` → export: no registry-addressable path loss; `category`, `title`, and `photos[]` survive.

**Artifact:** `apps/api/reports/template-canonical-ghost-fields.json`

---

## FAILED PAYLOAD DIAGNOSTIC

**Source:** `console.log` in `apps/web/src/features/tours/wizard/denali/createDenaliWizardUploadTour.ts` (immediately before `createTour`).

**Capture:** `pnpm --filter web exec tsx scripts/capture-upload-tour-create-payload.ts` — simulates `ensureUploadTourId` → `createDenaliWizardUploadTour` with one gallery row (`photosData.photos`, `uploadStatus: pending`, blob URL). API not called.

**Form state at capture:** `basicInfo.tourType = mountain_day`; `photosData.photos[0]` present (blob URL, pending).

**Logged `createTour` payload:**

```json
{
  "title": "پیش‌نویس — در حال تکمیل ویزارد",
  "description": "",
  "tourType": "mountain",
  "capacity": 1,
  "price": 0,
  "autoAcceptRegistrations": true,
  "lifecycle_status": "Draft",
  "tripDetails": {
    "overview": {
      "denaliTourKind": "mountain_day",
      "shortIntro": "",
      "leaderUserIds": []
    },
    "itinerary": {
      "segmentActivities": [
        {
          "dayNumber": 1,
          "title": "برنامه روز",
          "description": "برنامه روز",
          "segments": [
            {
              "title": "برنامه روز",
              "description": "برنامه روز"
            }
          ]
        }
      ]
    }
  },
  "transportModes": [],
  "metadata": {
    "vertical": "staging_shell",
    "isStagingShell": true
  }
}
```

**Observation:** `tripDetails.photos` / gallery rows from `photosData.photos` are **not** included in the staging-shell DTO sent to `POST` create tour.
---

## Draft-Engine 409 Concurrency Trace (2026-06-01)

**Generated:** 2026-06-01T02:17:21.387Z

### Instrumentation

- `draft-engine.client.ts` → `patch_start` / `patch_success` / `patch_409` with ISO timestamp, clientVersion, serverVersion on 409
- `denali-adapter.ts` → `adapter_on_push_start` before `patchDraftSnapshot`
- `WorkspaceTourWizard.tsx` → `wizard_watch_debounced`, `wizard_set_draft_user`, `wizard_set_draft_step` before `setDraftData({ source: 'user' })`
- Enable: `localStorage.draftEngineTrace=1` or `?draftTrace=1`

### WorkspaceTourWizard draft hooks (no direct `onPush` / `onChange`)

- RHF `watch()` debounced → `pushDraftUserEditRef` → `setDraftData` (engine debounce 500ms default in denali adapter)
- `currentStep` effect → immediate `setDraftData` (can fire near watch debounce)
- `onPush` is only on `DraftEngineConfig` in `denali-adapter.ts`, not in WorkspaceTourWizard

### Engine mutex probe (`DraftEngine.flushSync`)

| Metric | Value |
|--------|-------|
| Max concurrent `onPush` | 1 |
| Total `onPush` calls (rapid updates) | 2 |

### Simulated PATCH sequence — same client version (parallel)

| # | t+ms | clientVersion | outcome | serverAfter | concurrentWith |
|---|------|---------------|---------|-------------|----------------|
| 2 | 0 | 1 | **409** | 2 | — |
| 2 | 1 | 1 | **409** | 2 | 1 |

### Simulated PATCH sequence — server already ahead (sequential stale)

| # | t+ms | clientVersion | outcome | serverAfter |
|---|------|---------------|---------|-------------|
| 1 | 1 | 2 | **409** | 3 |
| 2 | 6 | 2 | **409** | 3 |

### Example trace timeline (409 path; enable `?draftTrace=1` in browser)

| Δms | Kind | Detail | Meta |
|-----|------|--------|------|
| 0 | wizard_watch_debounced | RHF watch → pushDraftUserEdit | debounceMs=400 |
| 1 | wizard_set_draft_user | pushDraftUserEditRef | currentStepIndex=0, draftStatus="DIRTY" |
| 0 | adapter_on_push_start | denali-create:ws-audit | version=2, lastModified=1780280241785 |
| 0 | patch_start | ws-audit/denali-create | clientVersion=2 |
| 1 | patch_409 | ws-audit/denali-create | clientVersion=2, serverVersion=3, elapsedMs=42 |

### Verdict

Not simultaneous PATCH from the client engine: `syncInFlight` mutex keeps one `onPush` at a time. Observed 409s match **optimistic concurrency** (`postgres-draft-snapshot.store`: reject when `clientVersion !== storedVersion`). Typical cause: server version advanced (another tab, prior successful PATCH, or initialize/fetch drift) while local engine still held an older `version` when PATCH was built.

**Conclusion:** **Stale client version** — server OCC expects `clientVersion === storedVersion`; 409 when server is ahead. `DraftEngine` serializes PATCH (max concurrent onPush = 1).

**Artifacts:** `apps/web/lib/draft-engine-trace.ts`, `apps/web/reports/draft-engine-concurrency-trace.json`
