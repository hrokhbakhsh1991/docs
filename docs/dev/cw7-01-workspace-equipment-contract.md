# CW7-01 — Workspace Equipment capability contract (design)

**Verdict:** **PASS**  
**Ledger task:** CW7-01  
**Status:** Design contract frozen — **no codegen/UI migration** (CW7-02+)  
**Prepared:** 2026-08-23 (Wave 6A)  
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
}
```

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
  }
}
```

Top-level `equipmentIconKeyValidator` and equipment `settingsEnrichers` row become **deprecated aliases** until CW7-02 migration removes them (compat reader: if block absent, fall back to legacy keys for Denali only during transition).

### 3.3 Example — workspace without equipment

```json
// absent block OR explicit off
"workspaceEquipment": { "supported": false }
```

**Isolation invariant (CW7-04):** `supported: false` or missing block → zero generated equipment bindings; `parse-equipment-icon-key` returns noop validator; no settings module row; `guestLanding.sections.equipment` must not auto-enable.

---

## 4. Persistence ownership statement

| Layer | Owns | Does not own |
|-------|------|----------------|
| **Host API** (`apps/api`) | `workspace_equipment` table CRUD, RLS, tenant scoping, sort order | Icon SVG assets, field registry paths |
| **Workspace package** | Icon registry module, field fragments, wizard UI composites | Database rows |
| **tour-core** | — | Equipment reference data (forbidden) |
| **workspace-sdk** | Generated capability flags + binding dispatch tables | Persistence |

### 4.1 `workspace_equipment` row contract (unchanged)

Prisma model `WorkspaceEquipment` (host-owned):

- `id`, `tenantId`, `name`, `category?`, `iconKey?`, `themeIds` (JSON array), `sortOrder`, timestamps
- Indexed by `(tenantId, sortOrder, name)`
- Access only through `withTenantRls` settings repository paths

### 4.2 Tour document contract

- Tours store **selected equipment ids** (or canonical paths workspace defines) — not embedded equipment rows.
- Registration snapshots may copy equipment labels at write time via workspace adapter (Denali parity).

---

## 5. Codegen outputs (CW7-02 targets)

| Generated artifact | Source field |
|--------------------|--------------|
| `apps/api/src/settings/workspace-equipment-icon-key-validator-bindings.generated.ts` | `workspaceEquipment.iconKeyValidator` (replaces top-level reader) |
| `apps/api/src/settings/workspace-settings-enrichers.generated.ts` | derive equipment enricher from block |
| `packages/workspace-sdk/src/catalog/workspace-equipment-capabilities.generated.ts` | capability flags per workspace |
| `packages/guest-workspace-runtime/...` (if needed) | `guestLandingSection` gating |
| Domain index entry in `workspace-registry-codegen-modularization.mdoc` | `workspaceEquipment` domain module |

**Coordinator-owned:** orchestrator domain `equipment.mjs` (new), manifest schema promotion.

---

## 6. Validation seam (static + runtime)

### 6.1 Codegen / manifest validation

- If `supported: true` and `capabilities.operatorSettings` → require `settingsEnricher` when wizard uses category compatibility (Denali parity).
- If `iconKeyValidator` present → module path must match `./settings/*` guard (existing settings-api rule).
- If `supported: false` → forbid non-empty `iconKeyValidator` / `fieldModule` (fail or warn per strict mode).
- `guestLandingSection: true` without `operatorSettings` → warn (marketing needs catalog source).

### 6.2 Runtime validation (CW7-03+)

- **Capability validation stage (CW8):** equipment field module validates tour equipment ids against tenant catalog (workspace adapter).
- **Publish readiness:** equipment-required rules stay **workspace policy** (Denali matrix), not tour-core.

---

## 7. UI seams

| Surface | Gate | Binding |
|---------|------|---------|
| Operator settings | `capabilities.operatorSettings` | existing settings modules UI |
| Wizard tour create/edit | `capabilities.wizardTourField` + optional `fieldModule` | workspace field registry fragment |
| Catalog detail | `capabilities.catalogDetailSection` | catalog presentation pipeline |
| Marketing home | `capabilities.guestLandingSection` | supersedes raw `guestLanding.sections.equipment` when block present |
| Portal registration | `capabilities.registrationSnapshot` | intake snapshot enricher |

**Denali icon registry:** remains `packages/workspaces/denali/settings/equipment-icon-registry` — generic default forbidden.

---

## 8. Relationship to profile composition (CW6)

`starter-outdoor` profile does **not** enable equipment by default. Equipment is opt-in via workspace manifest:

```json
"workspaceEquipment": { "supported": true, ... }
```

or future profile capability default block.

---

## 9. Tests required (CW7-02+)

| Test | Scope |
|------|-------|
| `workspace-equipment-codegen.spec.mjs` | manifest → generated capability flags |
| `denali-equipment-icon-registry.spec.ts` | parity after binding migration |
| `settings-resources.spec.ts` | CRUD unchanged |
| `cw7-04-equipment-isolation.spec.ts` | starter manifest → no equipment surface |
| `denali-equipment-parity.golden.spec` | CW7-03 field fragment |
| Extend `denali-coupling.contract.spec.ts` | CW7-15 — capability packages ≠ Denali ids |

---

## 10. Shared files future implementation MUST touch

| File | Change |
|------|--------|
| `packages/workspace-sdk/src/manifest.schema.ts` | `workspaceEquipment` Zod block (coordinator) |
| `scripts/codegen/workspace-registry/domains/equipment.mjs` | **New** domain |
| `scripts/codegen/workspace-registry/orchestrator.mjs` | Register domain |
| `scripts/codegen/workspace-registry/domains/settings-api.mjs` | Read block vs legacy keys |
| `apps/api/src/settings/parse-equipment-icon-key.ts` | Dispatch from new bindings |
| `packages/workspaces/denali/workspace.manifest.json` | Migrate to block |
| `docs/dev/denali-plugin-encapsulation.mdoc` | Document block |
| `docs/dev/workspace-registry-codegen-modularization.mdoc` | Domain table |

---

## 11. CW7-01 closure checklist

| Item | Status |
|------|--------|
| Configuration contract | ✅ `workspaceEquipment` block |
| Validation seam | ✅ static + CW8 stage mapping |
| UI seams | ✅ capability flags |
| Persistence ownership | ✅ host `workspace_equipment` |
| Registration mechanism | ✅ codegen domain sketched |
| Isolation tests specified | ✅ CW7-04 |
| Denali adapter boundary | ✅ icon registry stays Denali |
| Implementation deferred | ✅ CW7-02+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-01-workspace-equipment-contract.md`.*
