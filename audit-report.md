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
