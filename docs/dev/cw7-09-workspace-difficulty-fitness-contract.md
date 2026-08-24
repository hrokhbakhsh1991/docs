# CW7-09 — Workspace Difficulty/Fitness capability contract (design + codegen)

**Verdict:** **PASS**  
**Ledger task:** CW7-09  
**Status:** Contract frozen; codegen + Denali adapter bindings; **no full Denali field-registry migration**  
**Prepared:** 2026-08-24 (Wave 7B)  
**Deps satisfied:** CW5-11, existing `catalogPresentation` detail/list gates  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW7 per-capability six artifacts
- `docs/dev/cw7-01-workspace-equipment-contract.md` — top-level capability block pattern
- `docs/dev/cw-wave-6a-manifest-composition-model.md` — top-level extension blocks
- `packages/workspace-sdk/src/tour/public-catalog.contract.ts` — egress card fields
- `packages/workspace-sdk/src/catalog/resolve-catalog-detail-sections.ts` — presentation gates

---

## 1. Executive summary

Difficulty/Fitness becomes a **reusable Tour capability** with manifest block `workspaceDifficultyFitness`, following `workspaceEquipment` / `workspaceTransport`. **Presentation gates remain on `catalogPresentation`** (`detailSections.difficulty|fitness`, `listFeatures.serverListFilters`); the capability block owns **enablement**, optional **field-module** registration, **filter presentation** dispatch, and the **neutral egress data contract**.

Denali remains the reference adapter. **Difficulty scale (1–10 half-steps), mountaineering fitness enums, customer thresholds, and trek policy stay Denali-owned** (plan non-goals; TRUTH §MUST-NOT genericization of Denali trek semantics).

---

## 2. Current state (baseline)

| Concern | Today | Owner |
|---------|-------|-------|
| Marketing detail section gates | `catalogPresentation.detailSections` → `resolveCatalogDetailSections` | Manifest + guest-catalog codegen |
| Marketing list filter params | `catalogPresentation.listFeatures.serverListFilters` | Manifest + guest-catalog codegen |
| Egress card fields | `PublicCatalogCard.difficultyLevel`, `fitnessLevel`, `fitnessPrerequisiteText` | `public-catalog.contract.ts` |
| Marketing filter vocab | `DENALI_MARKETING_DIFFICULTY_LEVELS`, `DENALI_MARKETING_FITNESS_LEVELS`, `snapDenaliCatalogDifficultyLevel` | Denali `catalog-filter-config.ts` |
| Wizard fields | `program.difficultyLevel`, `participants.fitnessLevel`, … | Denali field registry + composites |
| Urban / guest-club | `detailSections.difficulty/fitness: false`; no list filters | Manifest |

**Gap:** no unified capability master switch; Denali difficulty semantics scattered across marketing surface, field registry, and filter config; workspaces without difficulty/fitness lack formal “off” contract beyond `catalogPresentation` booleans.

---

## 3. Manifest block — `workspaceDifficultyFitness`

### 3.1 Shape (Zod + codegen)

```ts
workspaceDifficultyFitness: {
  supported: boolean;
  capabilities?: {
    wizardTourField?: boolean;           // optional field-module fragment
    catalogDetailSection?: boolean;    // subordinate to catalogPresentation.detailSections
    catalogListFilters?: boolean;        // subordinate to catalogPresentation list filters
    catalogMarketingFilters?: boolean;   // filter vocab / snap hooks via filterPresentation
  };
  fieldModule?: { module: string; export: string };
  filterPresentation?: { module: string; export: string };
}
```

**`supported` vs surface flags:** `supported: false` (or absent block) is the **capability master switch**. Per-surface `capabilities.*` booleans gate seams only when `supported: true`. Unset capability flags default **false** at codegen (opt-in surfaces).

**`catalogPresentation` authority:** When `capabilities.catalogDetailSection` or `catalogListFilters` is true, codegen **asserts** matching `catalogPresentation` leaves (`detailSections.difficulty|fitness`, `serverListFilters` entries). Capability flags document intent; presentation booleans remain the marketing resolver source of truth (no duplicate codegen table for section gates).

### 3.2 Example — Denali (adapter binding, not field migration)

```json
"workspaceDifficultyFitness": {
  "supported": true,
  "capabilities": {
    "wizardTourField": true,
    "catalogDetailSection": true,
    "catalogListFilters": true,
    "catalogMarketingFilters": true
  },
  "fieldModule": {
    "module": "./field-registry/denali-difficulty-fitness-field-module",
    "export": "denaliDifficultyFitnessFieldRegistryFragment"
  },
  "filterPresentation": {
    "module": "./marketing/denali-difficulty-fitness-filter-presentation",
    "export": "denaliDifficultyFitnessFilterPresentation"
  }
}
```

### 3.3 Enabled / disabled semantics

| Layer | Signal | Effect when off |
|-------|--------|-----------------|
| **Manifest capability** | `workspaceDifficultyFitness` absent or `supported: false` | No codegen capability row; no field-module binding; no filter presentation dispatch |
| **Presentation** | `catalogPresentation.detailSections` | Marketing still uses `resolveCatalogDetailSections` — Urban keeps `difficulty/fitness: false` |
| **Per-surface flags** | `capabilities.*` | Individual wizard/filter seams omitted even if `supported: true` |
| **Isolation** | starter / urban / guest-club | Absent block → zero generated bindings (CW7-09 isolation spec) |

---

## 4. Generic capability behavior

When `workspaceDifficultyFitness.supported: true`, the platform provides:

1. **Codegen capability flags** — `workspace-difficulty-fitness-capabilities.generated.ts` projects manifest → boolean gates.
2. **Optional field-module dispatch** — `resolveWorkspaceDifficultyFitnessFieldRegistryFragment(workspaceType)` when `wizardTourField` + `fieldModule` bound (CW7-09 fragment contract).
3. **Optional filter presentation dispatch** — `resolveWorkspaceDifficultyFitnessFilterPresentation(workspaceType)` for marketing filter vocab hooks (workspace-owned scale/enums).
4. **Neutral egress contract** — `PublicCatalogDifficultyFitnessFields` documents egress-safe card fields; no platform default scale.
5. **Capability validation registry row** — `workspaceDifficultyFitness` id in `WORKSPACE_CAPABILITY_VALIDATORS` (validator bodies wire in later slices).
6. **Isolation default** — absent block or `supported: false` → none of the above; presentation gates independently controlled via `catalogPresentation`.

**Explicit non-goals (generic layer MUST NOT):**

- Ship platform default difficulty scale or fitness enum
- Copy Denali mountaineering labels or trek thresholds into tour-core / workspace-sdk
- Replace `resolveCatalogDetailSections` with a duplicate codegen table
- Redesign Denali wizard UX or migrate full `denaliFieldRegistryData` in this slice

---

## 5. Denali policy and data ownership

| Concern | Generic / host | Denali-owned (adapter) |
|---------|----------------|------------------------|
| Detail/list presentation gates | `catalogPresentation` codegen → SDK resolvers | Manifest leaves (`difficulty: true`, filters in `serverListFilters`) |
| Egress card shape | `PublicCatalogDifficultyFitnessFields` type | Adapter maps canonical → card scalars |
| Difficulty scale + snap | `filterPresentation` **dispatch** only | `catalog-filter-config.ts` — 1–10 half-steps, `snapDenaliCatalogDifficultyLevel` |
| Fitness enum vocabulary | dispatch only | `DENALI_MARKETING_FITNESS_LEVELS` (`low` / `medium` / `high`) |
| Wizard field rows | Field-module **seam** | `program.difficultyLevel`, `participants.fitnessLevel` registry rows, zod kinds, composites |
| Trek policy / publish matrix | CW8 `workspacePolicyValidation` | Denali publish readiness — not this capability |
| `fitnessPrerequisiteText` | Egress field on card contract | Denali canonical copy + presentation |

---

## 6. Persistence ownership

| Layer | Owns | Does not own |
|-------|------|----------------|
| **Host API** | Tour canonical paths at egress | Difficulty scale definitions |
| **Workspace package** | Field fragments, filter vocab, wizard UI | Generic defaults in SDK |
| **tour-core** | — | Difficulty/fitness semantics (forbidden) |
| **workspace-sdk** | Capability flags, dispatch tables, neutral egress types | Persistence |

Tour documents store **scalar difficulty/fitness values** on workspace-defined canonical paths (Denali: `program.difficultyLevel`, `participants.fitnessLevel`). No host reference table (unlike equipment).

---

## 7. Field-registry integration seam (optional)

| Binding | Purpose | Denali reference (CW7-09 adapter slice) |
|---------|---------|----------------------------------------|
| `fieldModule` | Registry fragment for core difficulty + fitness rows | `denali-difficulty-fitness-field-module.ts` |
| Full registry | Remaining rows stay in `denaliFieldRegistryData` | Full migration deferred |

**Integration flow:**

```text
workspaceDifficultyFitness.capabilities.wizardTourField === true
  → manifest fieldModule required at codegen assert
  → generated import table keyed by workspaceType
  → optional merge via mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments
```

---

## 8. Tests

| Spec | Coverage |
| ---- | -------- |
| `workspace-difficulty-fitness-codegen.spec.mjs` | Denali capability flags + fieldModule + filterPresentation bindings |
| `cw7-09-difficulty-fitness-isolation.spec.mjs` | starter / urban / guest-club zero bindings |
| `resolve-catalog-detail-sections.spec.ts` | Denali parity on presentation gates (unchanged) |
| `denali-difficulty-fitness-field-parity.spec.ts` | Fragment paths match registry rows |

---

## 9. Closure checklist

- [x] Design contract (this document)
- [x] Zod `WorkspaceDifficultyFitnessBlockSchema`
- [x] Codegen domain `difficulty-fitness.mjs`
- [x] SDK fragment + egress types
- [x] Denali manifest block + adapter modules
- [x] Isolation + codegen specs
- [x] `generate:workspace-registry --check`

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-09-workspace-difficulty-fitness-contract.md`.*
