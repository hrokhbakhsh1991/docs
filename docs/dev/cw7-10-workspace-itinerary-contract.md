# CW7-10 — Workspace Itinerary capability contract (design + codegen)

**Verdict:** **PASS**  
**Ledger task:** CW7-10  
**Status:** Contract frozen; codegen + Denali adapter bindings; **no global Denali itinerary schema**  
**Prepared:** 2026-08-24 (Wave 7B)  
**Deps satisfied:** CW5-11, existing `catalogPresentation.detailSections.itinerary` gate  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW7 per-capability six artifacts
- `docs/dev/cw7-09-workspace-difficulty-fitness-contract.md` — top-level capability block pattern
- `docs/dev/cw-wave-6a-manifest-composition-model.md` — top-level extension blocks
- `packages/workspace-sdk/src/tour/public-catalog.contract.ts` — egress `itineraryDays` fields
- `packages/workspace-sdk/src/catalog/resolve-catalog-detail-sections.ts` — presentation gates

---

## 1. Executive summary

Itinerary becomes a **reusable Tour capability** with manifest block `workspaceItinerary`, following `workspaceDifficultyFitness` / `workspaceEquipment`. **Presentation gates remain on `catalogPresentation`** (`detailSections.itinerary`); the capability block owns **enablement**, optional **field-module** registration, optional **wizard composite** binding, and the **neutral egress data contract** (`PublicCatalogItineraryDay` / `PublicCatalogItinerarySegment`).

Denali remains the reference adapter. **Day/segment structure, segment kinds, destination/photo matrix, and multi-day visibility rules stay Denali-owned** (plan non-goals; Urban forbids itinerary on persist).

---

## 2. Current state (baseline)

| Concern | Today | Owner |
|---------|-------|-------|
| Marketing detail section gate | `catalogPresentation.detailSections.itinerary` → `resolveCatalogDetailSections` | Manifest + guest-catalog codegen |
| Egress card fields | `PublicCatalogCard.itineraryDays` | `public-catalog.contract.ts` |
| Catalog projection | `projectDenaliCatalogItinerary` | Denali `project-denali-catalog-itinerary.ts` |
| Wizard field | `program.itinerary` composite `denali.itinerary` | Denali field registry + `denali-itinerary-field.tsx` |
| Urban / guest-club | `detailSections.itinerary: false`; Urban policy forbids persist | Manifest + workspace policy |

**Gap:** no unified capability master switch; Denali itinerary semantics scattered across field registry, composite registry, and catalog projection; workspaces without itinerary lack formal “off” contract beyond `catalogPresentation` booleans.

---

## 3. Manifest block — `workspaceItinerary`

### 3.1 Shape (Zod + codegen)

```ts
workspaceItinerary: {
  supported: boolean;
  capabilities?: {
    wizardTourField?: boolean;           // optional field-module fragment + wizard composite
    catalogDetailSection?: boolean;    // subordinate to catalogPresentation.detailSections
  };
  fieldModule?: { module: string; export: string };
  wizardComposite?: { module: string; export: string };
}
```

**`supported` vs surface flags:** `supported: false` (or absent block) is the **capability master switch**. Per-surface `capabilities.*` booleans gate seams only when `supported: true`. Unset capability flags default **false** at codegen (opt-in surfaces).

**`catalogPresentation` authority:** When `capabilities.catalogDetailSection` is true, codegen **asserts** `catalogPresentation.detailSections.itinerary === true`. Capability flags document intent; presentation booleans remain the marketing resolver source of truth.

**Wizard composite:** When `capabilities.wizardTourField` is true, codegen requires both `fieldModule` and `wizardComposite`. Composite UI stays workspace-owned (`denali-itinerary-field.tsx`); binding exports composite id + canonical path metadata only.

### 3.2 Example — Denali (adapter binding, not schema migration)

```json
"workspaceItinerary": {
  "supported": true,
  "capabilities": {
    "wizardTourField": true,
    "catalogDetailSection": true
  },
  "fieldModule": {
    "module": "./field-registry/denali-itinerary-field-module",
    "export": "denaliItineraryFieldRegistryFragment"
  },
  "wizardComposite": {
    "module": "./composites/denali-itinerary-composite-binding",
    "export": "denaliItineraryWizardCompositeBinding"
  }
}
```

### 3.3 Enabled / disabled semantics

| Layer | Signal | Effect when off |
|-------|--------|-----------------|
| **Manifest capability** | `workspaceItinerary` absent or `supported: false` | No codegen capability row; no field-module / wizard-composite bindings |
| **Presentation** | `catalogPresentation.detailSections` | Marketing still uses `resolveCatalogDetailSections` — Urban keeps `itinerary: false` |
| **Per-surface flags** | `capabilities.*` | Individual wizard/detail seams omitted even if `supported: true` |
| **Isolation** | starter / urban / guest-club / policy-cert | Absent block → zero generated bindings (CW7-10 isolation spec) |

---

## 4. Generic capability behavior

When `workspaceItinerary.supported: true`, the platform provides:

1. **Codegen capability flags** — `workspace-itinerary-capabilities.generated.ts` projects manifest → boolean gates.
2. **Optional field-module dispatch** — `resolveWorkspaceItineraryFieldRegistryFragment(workspaceType)` when `wizardTourField` + `fieldModule` bound.
3. **Optional wizard-composite dispatch** — `resolveWorkspaceItineraryWizardCompositeBinding(workspaceType)` when `wizardTourField` + `wizardComposite` bound.
4. **Neutral egress contract** — `PublicCatalogItineraryDay` / `PublicCatalogItinerarySegment` document egress-safe card fields; no platform default day/segment schema.
5. **Capability validation registry row** — `workspaceItinerary` id in `WORKSPACE_CAPABILITY_VALIDATORS`.
6. **Isolation default** — absent block or `supported: false` → none of the above.

**Explicit non-goals (generic layer MUST NOT):**

- Ship platform default itinerary day/segment schema
- Copy Denali segment kinds or matrix rules into tour-core / workspace-sdk
- Replace `resolveCatalogDetailSections` with a duplicate codegen table
- Redesign Denali wizard UX or migrate full `denaliFieldRegistryData` in this slice
- Change public tour detail semantics for existing Denali cards

---

## 5. Denali policy and data ownership

| Concern | Generic / host | Denali-owned (adapter) |
|---------|----------------|------------------------|
| Egress shape | `PublicCatalogItineraryDay` / `PublicCatalogItinerarySegment` | `denaliItineraryDaySchema`, segment kinds, photo/destination invariants |
| Wizard field | Fragment merge seam | `program.itinerary` paths, matrix tags, `denali.itinerary` composite |
| Catalog projection | Capability gate only | `projectDenaliCatalogItinerary` |
| Urban policy | N/A | Forbidden itinerary persist via `workspacePolicy` |

---

## 6. Integration flow

```text
workspaceItinerary.capabilities.wizardTourField === true
  → manifest fieldModule + wizardComposite required at codegen assert
  → generated import tables keyed by workspaceType
  → Denali adapter consumes generic defineWorkspaceItineraryFieldFragment
  → composite binding exposes denali.itinerary → program.itinerary (workspace UI unchanged)

workspaceItinerary.capabilities.catalogDetailSection === true
  → assert catalogPresentation.detailSections.itinerary
  → marketing detail section gate unchanged (no duplicate table)
```

---

## 7. Verification matrix

| Check | Evidence |
|-------|----------|
| Capability present (Denali) | `workspace-itinerary-capabilities.generated.ts` row for `denali` |
| Capability absent (isolated) | `cw7-10-itinerary-isolation.spec.mjs` |
| Denali parity | `denali-itinerary-field-parity.spec.ts` |
| Registry determinism | `pnpm run generate:workspace-registry --check` |
| Isolation guards | starter / guest-club / urban / policy-cert zero bindings |
| Codegen diff-check | `workspace-itinerary-codegen.spec.mjs` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-10-workspace-itinerary-contract.md`.*
