# CW7-01 — Workspace Equipment capability contract (design)

**Verdict:** **PASS**  
**Ledger task:** CW7-01  
**Status:** Design contract frozen — **no codegen/UI migration** (CW7-02+)  
**Prepared:** 2026-08-23 (Wave 6A)  
**Worker B closure:** 2026-08-23 — explicit generic vs Denali ownership, enabled/disabled semantics, field-registry + adapter + icon seams  
**Deps satisfied:** CW5-11, CW2-05 equipment icon validator binding  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW7 per-capability six artifacts
- `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` (AUDIT) §6 WL
- `.architecture-analysis/SHARED-TOUR-CORE-EXTRACTION-FEASIBILITY.md` (FEAS) §5
- `docs/dev/denali-plugin-encapsulation.mdoc` — CW2-05 `equipmentIconKeyValidator`
- `apps/api/prisma/schema.prisma` — `WorkspaceEquipment` model

---

## 1. Executive summary

Equipment becomes the **first reusable Tour capability** with a formal manifest block `workspaceEquipment`, following the `workspaceBooking` / `workspaceFinance` pattern. Denali remains the reference adapter; **icon registry stays Denali-owned** (FEAS §2.4; plan non-goal #9).

**Persistence:** tenant-scoped reference rows in host table `workspace_equipment` remain **API-owned** (Prisma settings repository). The capability declares bindings and surfaces; it does not move persistence into tour-core or workspace packages.

---

## 2. Current state (baseline)

| Concern | Today | Owner |
|---------|-------|-------|
| Operator settings CRUD | `prisma-settings-resources.repository.ts` → `workspaceEquipment` | `apps/api` |
| Icon key validation | Top-level `equipmentIconKeyValidator` on Denali manifest | CW2-05 codegen → `parse-equipment-icon-key.ts` |
| Category enricher | `settingsEnrichers[]` row `settingsModuleId: "equipment"` | Denali manifest |
| Marketing landing section | `guestLanding.sections.equipment` boolean | Per-workspace manifest |
| Wizard / catalog fields | Denali field registry + composites | `packages/workspaces/denali` |
| Tour canonical storage | Equipment **ids** on tour documents | Workspace adapters |

**Gap:** no unified capability block; equipment scattered across manifest keys; workspaces without equipment have no formal “off” contract.

---

## 3. Manifest block — `workspaceEquipment`

### 3.1 Shape (proposed Zod, CW7-02)

```ts
workspaceEquipment: {
  supported: boolean;                    // required when block present
  defaultModuleEnabledWhenUnset?: boolean; // tenant module toggle default
  capabilities?: {
    operatorSettings?: boolean;          // settings UI + API CRUD
    wizardTourField?: boolean;           // tour wizard equipment selection field
    catalogDetailSection?: boolean;      // tour detail equipment section
    guestLandingSection?: boolean;       // marketing home equipment strip
    registrationSnapshot?: boolean;      // include equipment in registration payload
  };
  iconKeyValidator?: {
    module: string;                      // relative ./settings/* only
    export: string;                      // e.g. isKnownEquipmentIconKey
  };
  settingsEnricher?: {
    module: string;
    export: string;                      // resolveEquipmentCompatibleCategories
    targetField: "compatibleCategories";
    sourceField: "category";
  };
  fieldModule?: {
    module: string;                      // optional CW7-03 fragment
    export: string;
  };
  wizardComposite?: {
    module: string;
    export: string;                      // optional composite surface binding
  };
  settingsEquipmentUi?: {
    module: string;                      // operator settings icon picker / avatar surface
    export: string;                      // e.g. denaliSettingsEquipmentUiSurface
  };
  themeFilter?: {
    module: string;                      // optional catalog/wizard theme intersection policy
    export: string;                      // e.g. isEquipmentCompatibleWithTourThemes
  };
}
```

**`supported` vs surface flags:** `supported: false` (or absent block) is the **capability master switch**. Per-surface `capabilities.*` booleans gate individual seams only when `supported: true`. Unset capability flags default **false** at codegen (opt-in surfaces).

### 3.2 Example — Denali (conceptual migration target)

```json
"workspaceEquipment": {
  "supported": true,
  "defaultModuleEnabledWhenUnset": true,
  "capabilities": {
    "operatorSettings": true,
    "wizardTourField": true,
    "catalogDetailSection": true,
    "guestLandingSection": true,
    "registrationSnapshot": true
  },
  "iconKeyValidator": {
    "module": "./settings/equipment-icon-registry",
    "export": "isKnownEquipmentIconKey"
  },
  "settingsEnricher": {
    "module": "./settings/equipment-compatible-categories",
    "export": "resolveEquipmentCompatibleCategories",
    "targetField": "compatibleCategories",
    "sourceField": "category"
  },
  "settingsEquipmentUi": {
    "module": "./ui/settings/settings-equipment-ui-surface",
    "export": "denaliSettingsEquipmentUiSurface"
  },
  "themeFilter": {
    "module": "./settings/equipment-compatible-themes",
    "export": "isEquipmentCompatibleWithTourThemes"
  }
}
```

Top-level `equipmentIconKeyValidator`, equipment `settingsEnrichers` row, and top-level `settingsEquipmentUi` become **deprecated aliases** until CW7-02 migration removes them (compat reader: if `workspaceEquipment` absent, fall back to legacy keys for Denali only during transition).

### 3.3 Enabled / disabled semantics

| Layer | Signal | Effect when off |
|-------|--------|-----------------|
| **Manifest capability** | `workspaceEquipment` absent or `supported: false` | No codegen equipment bindings; no equipment surfaces regardless of other manifest keys |
| **Tenant module toggle** | `defaultModuleEnabledWhenUnset` + tenant `operator_modules` row | When unset, tenant inherits manifest default; when module disabled, settings CRUD returns `SETTINGS_MODULE_UNKNOWN` (Urban parity today) |
| **Per-surface flags** | `capabilities.operatorSettings`, `wizardTourField`, etc. | Individual UI/API/marketing seams omitted even if `supported: true` |
| **Legacy guest landing** | `guestLanding.sections.equipment` | **Subordinate:** when `workspaceEquipment` block present, `capabilities.guestLandingSection` is authoritative; raw section boolean ignored for codegen gating |
| **Runtime noop** | `resolveEquipmentIconKeyValidator` | Returns `undefined` → `parseEquipmentIconKeyInput` accepts any non-empty string or null (no allowlist) |

**Denali today:** `guestLanding.sections.equipment: false` (marketing strip off) while operator equipment settings + wizard gear field remain on — per-surface flags model this split explicitly.

**guest-club / starter / urban:** `guestLanding.sections.equipment: false`; no equipment manifest bindings → full isolation (no settings module, no wizard field, no marketing strip).

### 3.4 Example — workspace without equipment

```json
// absent block OR explicit off
"workspaceEquipment": { "supported": false }
```

**Isolation invariant (CW7-04):** `supported: false` or missing block → zero generated equipment bindings; `parse-equipment-icon-key` returns noop validator; no settings module row; `guestLanding.sections.equipment` must not auto-enable; `POST /settings/resources/equipment` → `SETTINGS_MODULE_UNKNOWN` (existing Urban regression).

---

## 4. Generic Equipment capability behavior (Q1)

When a workspace declares `workspaceEquipment.supported: true`, the **platform** provides:

1. **Reference catalog persistence** — tenant-scoped rows in host `workspace_equipment` via settings repository (`prisma-settings-resources.repository.ts`); RLS-bound CRUD at `/settings/resources/equipment`.
2. **Codegen capability flags** — `workspace-equipment-capabilities.generated.ts` projects manifest block → boolean gates for operator settings, wizard field, catalog detail, guest landing, registration snapshot.
3. **Settings validation dispatch** — `resolveEquipmentIconKeyValidator(workspaceType)` from generated bindings; `parseEquipmentIconKeyInput` stays workspace-agnostic (CW2-05).
4. **Settings enricher dispatch** — category → `compatibleCategories` projection when `settingsEnricher` bound (generated enrichers table).
5. **Capability validation hook point (CW8)** — when `wizardTourField` enabled, capability stage validates selected equipment **ids** exist in tenant catalog (generic structural rule); publish-required gear rules stay workspace policy.
6. **Tour document contract** — tours store **equipment id references** on canonical paths workspace field registry defines (Denali: `participants.gearItems` → `tripDetails.participation` gear ids); host does not embed equipment rows on tour documents.
7. **Isolation default** — absent block or `supported: false` → none of the above activates; zero equipment API module; zero UI bindings; noop icon validator.

**Explicit non-goals (generic layer MUST NOT):**

- Ship a platform default icon registry or SVG set
- Copy Denali gear categories, icon keys, or Persian keyword suggestions into tour-core / workspace-sdk
- Move `workspace_equipment` persistence into workspace packages or tour-core
- Auto-enable marketing equipment strip from legacy `guestLanding.sections.equipment` without capability block

---

## 5. Denali policy and data ownership (Q2)

| Concern | Generic / host | Denali-owned (adapter) |
|---------|----------------|------------------------|
| `workspace_equipment` rows | Host API CRUD + RLS | Tenant catalog **content** (names, categories operators enter) |
| Icon allowlist + name suggestions | Validator **dispatch** only | `settings/equipment-icon-registry.ts` — closed key set, `labelKey`, keywords (hiking/camp/clothing/safety…) |
| Icon picker / catalog avatar UI | `settingsEquipmentUi` capability seam + thin-shell registry | `EquipmentIconPicker`, `EquipmentCatalogAvatar`, Denali CSS (`wizard-fields.css`) |
| Category compatibility enricher | Enricher **dispatch** | `resolveEquipmentCompatibleCategories` — Denali category taxonomy |
| Theme intersection filter | Optional `themeFilter` binding slot | `isEquipmentCompatibleWithTourThemes` — used in `denali-catalog-filters.ts` |
| Wizard gear field | Field-registry + composite **seams** | `participants.gearItems` field row, `zodKind: gearItems`, composite `denali.gear` renderer |
| Wizard composite UI | Composite registry dispatch | `denali-composite-registry.ts` gear picker UX |
| Publish readiness (gear required) | CW8 `workspacePolicyValidation` stage | Denali publish matrix / `validatePublishReadiness` — not generic capability |
| Registration snapshot labels | Snapshot enricher **hook** | Denali adapter copies labels at write time |
| Marketing landing strip | `guestLandingSection` gate | Denali PDP/marketing presentation (currently off: `guestLanding.sections.equipment: false`) |
| Operator settings nav module | Settings module id `equipment` when `operatorSettings` | `denali-settings.manifest.ts` route + ability `operator.settings.equipment` |
| `themeIds` on equipment rows | JSON column on host model | Denali operators choose theme linkage; filter logic Denali module |

**Boundary rule:** generic codegen knows **whether** equipment surfaces exist and **where** workspace modules bind; Denali packages own **what** icons, categories, labels, and publish rules mean.

---

## 6. Persistence ownership statement

| Layer | Owns | Does not own |
|-------|------|----------------|
| **Host API** (`apps/api`) | `workspace_equipment` table CRUD, RLS, tenant scoping, sort order | Icon SVG assets, field registry paths |
| **Workspace package** | Icon registry module, field fragments, wizard UI composites | Database rows |
| **tour-core** | — | Equipment reference data (forbidden) |
| **workspace-sdk** | Generated capability flags + binding dispatch tables | Persistence |

### 6.1 `workspace_equipment` row contract (unchanged)

Prisma model `WorkspaceEquipment` (host-owned):

- `id`, `tenantId`, `name`, `category?`, `iconKey?`, `themeIds` (JSON array), `sortOrder`, timestamps
- Indexed by `(tenantId, sortOrder, name)`
- Access only through `withTenantRls` settings repository paths

### 6.2 Tour document contract

- Tours store **selected equipment ids** (or canonical paths workspace defines) — not embedded equipment rows.
- Registration snapshots may copy equipment labels at write time via workspace adapter (Denali parity).

---

## 7. Field-registry integration seam

Equipment tour fields are **not** platform-global. Workspace adapter supplies optional bindings:

| Binding | Purpose | Denali reference |
|---------|---------|------------------|
| `fieldModule` | Field-registry fragment export (canonical paths, zod kinds, wire rules) | CW7-03 — `denaliFieldRegistryData` `participants.gearItems` row |
| `wizardComposite` | Composite renderer id → module map for gear picker UI | `denali.gear` in `denali-composite-registry.ts` |
| `zodKind: gearItems` | Workspace-owned Zod + hydration (equipment id arrays, clone filtering inactive ids) | `denali-tour-clone-hydration.spec.ts` parity |

**Integration flow (CW7-03):**

```text
workspaceEquipment.capabilities.wizardTourField === true
  → codegen emits field fragment import
  → platform wizard merges fragment into workspace field registry
  → composite registry resolves gear picker via wizardComposite binding
  → canonical write path splits gearItems → tripDetails.participation gearRequiredIds / gearOptionalIds (Denali wire)
```

**When capability absent:** no `gearItems` / `participants.gearItems` field row emitted; wizard steps omit gear composite; tour documents may omit participation gear ids entirely.

**Field-registry migration:** CW7-03 extracts optional module; CW7-01 does **not** migrate Denali field registry — documents seam only.

---

## 8. Workspace adapter responsibility

The **workspace adapter** (e.g. Denali package) owns all product semantics the generic capability does not define:

| Responsibility | Adapter module (Denali) | Generic never does |
|----------------|-------------------------|-------------------|
| Declare manifest `workspaceEquipment` block + bindings | `workspace.manifest.json` | Auto-enable for all outdoor workspaces |
| Icon registry + suggestions | `equipment-icon-registry.ts` | Default icon set |
| Settings UI surfaces | `settings-equipment-ui-surface.ts` → `capabilities.settingsEquipmentUi` | Shared picker component defaults |
| Category / theme compatibility | `equipment-compatible-categories.ts`, `equipment-compatible-themes.ts` | Denali taxonomy as platform default |
| Wizard gear UX | `denali.gear` composite + field registry | Generic gear picker |
| Catalog / marketing presentation | `denali-catalog-filters.ts`, marketing surfaces | Equipment strip content |
| Publish / draft validation policy | `validatePublishReadiness`, publish matrix | Gear-required rules in tour-core |
| Registration snapshot enrichment | Registration adapter paths | Label copy logic in API host |
| Tenant catalog seed content | Dev bootstrap / operator CRUD data | Denali equipment names in platform seed |

**Host API adapter surface:** workspace type → generated bindings (`resolveEquipmentIconKeyValidator`, enrichers, capability flags). Host **never** imports Denali registry directly except via generated files (CW2-05 / PSR-4b).

---

## 9. Icon strategy

| Aspect | Rule |
|--------|------|
| **Ownership** | Each workspace with `operatorSettings` supplies `iconKeyValidator` → workspace-owned registry module under `./settings/*` |
| **Validation** | Host `parseEquipmentIconKeyInput` delegates to generated `resolveEquipmentIconKeyValidator`; invalid key → `SettingsResourceInvalidError` |
| **Noop path** | Workspace without binding: validator undefined; only trim + empty→null — **no** platform allowlist |
| **UI assets** | SVG/icon components live in workspace package; published via `settingsEquipmentUi.ensureReady` to `app-cloud.settingsEquipmentUiSurface` (thin-shell Map keyed by pluginId) |
| **Display** | Operator settings + wizard use workspace picker/avatar; marketing/catalog may reuse same surface when enabled |
| **Forbidden** | Platform default / generic icon registry; copying Denali `EQUIPMENT_ICON_ENTRIES` into workspace-sdk or tour-core; host direct import of workspace icon modules |

**Denali icon keys (illustrative, not platform defaults):** `backpack`, `trekking_poles`, `tent`, `sleeping_bag`, `helmet`, `first_aid`, … — closed set in Denali registry only.

---

## 10. Codegen / registration seam (CW7-02 targets)

| Generated artifact | Source field |
|--------------------|--------------|
| `apps/api/src/settings/workspace-equipment-icon-key-validator-bindings.generated.ts` | `workspaceEquipment.iconKeyValidator` (replaces top-level reader) |
| `apps/api/src/settings/workspace-settings-enrichers.generated.ts` | derive equipment enricher from block |
| `packages/workspace-sdk/src/catalog/workspace-equipment-capabilities.generated.ts` | capability flags per workspace |
| `packages/workspace-sdk` settings equipment UI projection | `workspaceEquipment.settingsEquipmentUi` (replaces top-level `settingsEquipmentUi` reader in `guest-catalog.mjs`) |
| `packages/guest-workspace-runtime/...` (if needed) | `guestLandingSection` gating |
| Domain index entry in `workspace-registry-codegen-modularization.mdoc` | `workspaceEquipment` domain module |

**Coordinator-owned:** orchestrator domain `equipment.mjs` (new), manifest schema promotion.

**Registration mechanism:** `pnpm run generate:workspace-registry` after manifest change; `--check` determinism; equipment domain emits only rows for `supported: true` workspaces.

---

## 11. Validation seam (static + runtime)

### 11.1 Codegen / manifest validation

- If `supported: true` and `capabilities.operatorSettings` → require `settingsEnricher` when wizard uses category compatibility (Denali parity).
- If `capabilities.operatorSettings` → require `iconKeyValidator` + `settingsEquipmentUi` (operator CRUD needs validator + picker).
- If `iconKeyValidator` present → module path must match `./settings/*` guard (existing settings-api rule).
- If `supported: false` → forbid non-empty `iconKeyValidator` / `fieldModule` / `settingsEquipmentUi` (fail or warn per strict mode).
- `guestLandingSection: true` without `operatorSettings` → warn (marketing needs catalog source).

### 11.2 Runtime validation (CW7-03+ / CW8)

- **Capability validation stage (CW8):** when `wizardTourField`, validate tour equipment ids ∈ tenant `workspace_equipment` catalog (structural); optional `themeFilter` for wizard/catalog filtering.
- **Publish readiness:** equipment-required rules stay **workspace policy** (Denali matrix), not tour-core — CW8 `workspacePolicyValidation` stage.

---

## 12. UI seams

| Surface | Gate | Binding |
|---------|------|---------|
| Operator settings CRUD | `capabilities.operatorSettings` | settings module `equipment` + `/settings/resources/equipment` |
| Operator settings icon UI | `capabilities.operatorSettings` + `settingsEquipmentUi` | `resolveSettingsEquipmentUiCapability` → thin-shell surface |
| Wizard tour create/edit | `capabilities.wizardTourField` + `fieldModule` + `wizardComposite` | field registry + `denali.gear` composite |
| Catalog detail | `capabilities.catalogDetailSection` | catalog presentation pipeline + optional `themeFilter` |
| Marketing home | `capabilities.guestLandingSection` | supersedes raw `guestLanding.sections.equipment` when block present |
| Portal registration | `capabilities.registrationSnapshot` | intake snapshot enricher |

---

## 13. Isolation semantics (capability absent)

When `workspaceEquipment` is absent or `supported: false`:

| Layer | Expected behavior |
|-------|-------------------|
| Codegen | No row in equipment icon validator bindings, enrichers, capability flags, settings UI projection |
| API | `POST/GET/PATCH/DELETE /settings/resources/equipment` → `404 SETTINGS_MODULE_UNKNOWN` |
| Icon parse | `resolveEquipmentIconKeyValidator` → `undefined` (noop) |
| Wizard | No gear field row; no gear composite in step manifest |
| Marketing | No equipment landing section regardless of `guestLanding.sections.equipment` when block governs |
| Portal | No equipment section in registration snapshot enricher |
| Catalog detail | No equipment PDP section gate |
| tour-core | No equipment-specific ports invoked |

**CW7-04 proof targets:** `starter`, `guest-club`, `urban` manifests — zero equipment surfaces; Denali unchanged.

---

## 14. Relationship to profile composition (CW6)

`starter-outdoor` profile does **not** enable equipment by default. Equipment is opt-in via workspace manifest:

```json
"workspaceEquipment": { "supported": true, ... }
```

or future profile capability default block.

---

## 15. Tests required (CW7-02+)

| Test | Scope |
|------|-------|
| `workspace-equipment-codegen.spec.mjs` | manifest → generated capability flags + settings UI projection |
| `denali-equipment-icon-registry.spec.ts` | parity after binding migration |
| `settings-resources.spec.ts` | CRUD unchanged |
| `cw7-04-equipment-isolation.spec.ts` | starter / guest-club / urban → no equipment surface; Urban `SETTINGS_MODULE_UNKNOWN` |
| `denali-equipment-parity.golden.spec` | CW7-03 field fragment |
| Extend `denali-coupling.contract.spec.ts` | CW7-15 — capability packages ≠ Denali ids |

---

## 16. Required future schema / codegen changes (coordinator-owned)

| File | Change |
|------|--------|
| `packages/workspace-sdk/src/manifest.schema.ts` | `workspaceEquipment` Zod block (coordinator) |
| `scripts/codegen/workspace-registry/domains/equipment.mjs` | **New** domain — capability flags, icon validator, enricher, settings UI |
| `scripts/codegen/workspace-registry/orchestrator.mjs` | Register `equipment` domain |
| `scripts/codegen/workspace-registry/domains/settings-api.mjs` | Read block vs legacy keys (`equipmentIconKeyValidator`, enrichers row) |
| `scripts/codegen/workspace-registry/domains/guest-catalog.mjs` | Read `workspaceEquipment.settingsEquipmentUi` vs top-level `settingsEquipmentUi` |
| `apps/api/src/settings/parse-equipment-icon-key.ts` | Dispatch from new bindings (no behavior change) |
| `packages/workspaces/denali/workspace.manifest.json` | Migrate to `workspaceEquipment` block |
| `docs/dev/denali-plugin-encapsulation.mdoc` | Document block + CW2-05 alias deprecation |
| `docs/dev/workspace-registry-codegen-modularization.mdoc` | Domain table row |

**CW7-01 does not modify these files** — Worker B / coordinator implements at CW7-02+.

---

## 17. CW7-01 closure checklist

| Item | Status |
|------|--------|
| Manifest shape | ✅ `workspaceEquipment` block + bindings |
| Enabled/disabled semantics | ✅ §3.3 master switch + per-surface flags |
| Persistence ownership | ✅ host `workspace_equipment` §6 |
| Validation seam | ✅ §11 static + CW8 stage mapping |
| UI seams | ✅ §12 including `settingsEquipmentUi` |
| Field-registry integration | ✅ §7 |
| Workspace adapter responsibility | ✅ §8 |
| Codegen/registration seam | ✅ §10 |
| Icon strategy | ✅ §9 — no generic registry |
| Isolation semantics | ✅ §13 + CW7-04 tests |
| Generic vs Denali (Q1/Q2) | ✅ §4–5 |
| Denali adapter boundary | ✅ icon registry + product data stay Denali |
| Implementation deferred | ✅ CW7-02+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-01-workspace-equipment-contract.md`.*
