# CW7-05 — Workspace Transport capability contract (design)

**Verdict:** **PASS**  
**Ledger task:** CW7-05  
**Status:** Design contract frozen — **no codegen/UI migration** (CW7-06+)  
**Prepared:** 2026-08-23 (Wave 6E)  
**Deps satisfied:** CW5-11, CW7-04 equipment isolation precedent  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW7 per-capability six artifacts; non-goal #6 (TRUTH §24)
- `docs/dev/cw7-01-workspace-equipment-contract.md` — capability block pattern
- `docs/dev/cw-wave-6a-manifest-composition-model.md` — top-level `workspaceTransport` slot
- `docs/dev/cw8-01-validation-pipeline-contract.md` — `capabilityValidation` stage mapping
- `packages/workspace-sdk/src/tour/public-catalog-transport.ts` — egress snapshot type
- `packages/workspace-sdk/src/catalog/catalog-intake-transport-surface.ts` — intake surface contract

---

## 1. Executive summary

Transport becomes the **second reusable Tour capability** with a formal manifest block `workspaceTransport`, following the `workspaceEquipment` / `workspaceBooking` pattern. Unlike equipment, transport has **no host reference table** — operator-authored transport configuration lives on the **tour canonical document**; member registration choices persist on the **registration intake payload** and project to list scalars (`transportKind`).

Denali remains the reference adapter. **Dong amount semantics, personal-car opt-in rules, Denali transport mode vocabulary, and customer vehicle policies stay Denali-owned** (composable plan non-goal #6; TRUTH §24 MUST-NOT).

**Persistence:** tour canonical paths + registration intake + roster projection scalars remain **host/API-owned storage** with workspace adapters supplying read/normalize/intake bindings. The capability declares seams; it does not move Denali transport rules into tour-core or workspace-sdk defaults.

---

## 2. Current state (baseline)

| Concern | Today | Owner |
|---------|-------|-------|
| Tour wizard transport fields | Denali field registry `transport.*` + `denali.transport-mode` composite | `packages/workspaces/denali` |
| Catalog egress snapshot | `readDenaliCatalogTransportSnapshot` → `PublicCatalogTransportSnapshot` | Denali adapter |
| Portal registration transport UI | `denaliCatalogTransportIntakeSurface` on `catalogIntake.transport` | Denali adapter |
| Portal flow hydration | `catalogRegistrationFlow.transportInitializerExport` → codegen `workspace-registration-transport-initializers.generated.ts` | Denali manifest + registration domain |
| Registration API normalize | `normalizeDenaliRegistrationTransportIntake` (dong / personal-car / shared_cars) | Denali HTTP module |
| Marketing/catalog logistics | `PublicCatalogTransportSnapshot` on catalog cards; detail logistics section | Denali read adapter + presentation |
| List/roster projection | `transportKind` scalar (`primary` \| `personal_car` \| `no_car_dong` \| `no_car_acquaintance`) | Host bookings repository + SDK contract |
| SDK transport types | `PublicCatalogTransportMode`, `PublicCatalogTransportSnapshot`, `PublicCatalogRegistrationTransportKind`, `WorkspaceCatalogIntakeTransportSurface` | `workspace-sdk` (shape only — no product rules) |

**Gap:** transport capability scattered across `catalogRegistrationFlow.transportInitializerExport`, plugin `catalogIntake.transport`, field registry, and Denali HTTP modules; workspaces without transport have no formal “off” contract; SDK intake state types embed Denali-shaped fields (`paysDong`, `optInPersonalCar`) without manifest gating.

---

## 3. Manifest block — `workspaceTransport`

### 3.1 Shape (proposed Zod, CW7-06 coordinator)

```ts
workspaceTransport: {
  supported: boolean;                    // required when block present
  capabilities?: {
    wizardTourField?: boolean;           // tour wizard transport composite + field rows
    catalogSnapshot?: boolean;           // tour → PublicCatalogTransportSnapshot reader
    catalogDetailSection?: boolean;      // marketing/catalog logistics transport display
    registrationIntake?: boolean;        // portal intake transport follow-up surface
    registrationInitializer?: boolean;   // portal flow state hydration from tourTransport
    listProjection?: boolean;            // transportKind on bookings list / roster
    registrationNormalize?: boolean;     // API-side intake normalize/validate binding
  };
  catalogSnapshotReader?: {
    module: string;                      // relative ./catalog/* only
    export: string;                      // e.g. readDenaliCatalogTransportSnapshot
  };
  registrationInitializer?: {
    module: string;                      // relative ./catalog/registration-flow/*
    export: string;                      // e.g. registerDenaliCatalogRegistrationTransportInitializer
  };
  catalogIntakeTransportSurface?: {
    module: string;                      // relative ./catalog/*
    export: string;                      // e.g. denaliCatalogTransportIntakeSurface
  };
  registrationTransportNormalizer?: {
    module: string;                      // relative ./http/*
    export: string;                      // e.g. normalizeDenaliRegistrationTransportIntake
  };
  fieldModule?: {
    module: string;                      // optional CW7-07 fragment
    export: string;
  };
  wizardComposite?: {
    module: string;
    export: string;                      // e.g. denali.transport-mode anchor binding
  };
}
```

**`supported` vs surface flags:** `supported: false` (or absent block) is the **capability master switch**. Per-surface `capabilities.*` booleans gate individual seams only when `supported: true`. Unset capability flags default **false** at codegen (opt-in surfaces).

**Inner `capabilities` object:** surface flags **inside** the block — not a manifest namespace (same convention as `workspaceEquipment.capabilities` per Wave 6A).

### 3.2 Example — Denali (conceptual migration target, CW7-07)

```json
"workspaceTransport": {
  "supported": true,
  "capabilities": {
    "wizardTourField": true,
    "catalogSnapshot": true,
    "catalogDetailSection": true,
    "registrationIntake": true,
    "registrationInitializer": true,
    "listProjection": true,
    "registrationNormalize": true
  },
  "catalogSnapshotReader": {
    "module": "./catalog/read-denali-catalog-transport",
    "export": "readDenaliCatalogTransportSnapshot"
  },
  "registrationInitializer": {
    "module": "./catalog/registration-flow/register-transport-initializer",
    "export": "registerDenaliCatalogRegistrationTransportInitializer"
  },
  "catalogIntakeTransportSurface": {
    "module": "./catalog/denali-catalog-transport-intake",
    "export": "denaliCatalogTransportIntakeSurface"
  },
  "registrationTransportNormalizer": {
    "module": "./http/resolve-denali-registration-transport",
    "export": "normalizeDenaliRegistrationTransportIntake"
  },
  "fieldModule": {
    "module": "./field-registry/denali-transport-field-module",
    "export": "denaliTransportFieldRegistryFragment"
  },
  "wizardComposite": {
    "module": "./composites/denali-composite-registry",
    "export": "denaliTransportModeCompositeBinding"
  }
}
```

**Deprecation path:** `catalogRegistrationFlow.transportInitializerExport` becomes a **deprecated alias** until CW7-07 migration. Compat reader: when `workspaceTransport` absent, fall back to legacy key for Denali only during transition (same pattern as equipment top-level aliases in CW7-02).

### 3.3 Enabled / disabled semantics

| Layer | Signal | Effect when off |
|-------|--------|-----------------|
| **Manifest capability** | `workspaceTransport` absent or `supported: false` | No codegen transport bindings; no transport surfaces regardless of other manifest keys |
| **Per-surface flags** | `capabilities.wizardTourField`, `registrationIntake`, etc. | Individual wizard/catalog/portal/API seams omitted even if `supported: true` |
| **Intake schema feature** | `catalogIntake.features.transportIntake` | **Subordinate:** when `workspaceTransport` block present, `capabilities.registrationIntake` is authoritative for codegen gating; legacy `transportIntake: true` on plugin schema ignored for registry emission |
| **Runtime noop** | missing `catalogSnapshotReader` | catalog cards omit `transport` snapshot field |
| **Runtime noop** | missing `registrationTransportNormalizer` | host registration path does not apply workspace transport normalize (workspace without transport intake) |

**Denali today:** full transport stack on tours with organized/shared modes; portal DEN-TRANS-01..03 smoke parity.

**starter / guest-club / urban:** no transport manifest bindings → full isolation (no wizard transport composite, no portal transport follow-up, no `transportInitializerExport`).

### 3.4 Example — workspace without transport

```json
// absent block OR explicit off
"workspaceTransport": { "supported": false }
```

**Isolation invariant (CW7-08):** `supported: false` or missing block → zero generated transport bindings; portal registration omits transport initializer; catalog cards have no `transport` snapshot; wizard omits `transport.*` field rows; list projection `transportKind` stays `null`.

---

## 4. Generic Transport capability behavior (Q1)

When a workspace declares `workspaceTransport.supported: true`, the **platform** provides:

1. **Tour document transport slot** — workspace field registry defines canonical paths (`transport.mode`, cost/dong leaves, etc.); host persists on tour canonical document / trip details wire paths the adapter declares. Generic layer stores **opaque canonical JSON** — no Denali mode enum in tour-core.
2. **Codegen capability flags** — `workspace-transport-capabilities.generated.ts` projects manifest block → boolean gates per surface (wizard, catalog, registration, list).
3. **Catalog snapshot dispatch** — generated `resolveCatalogTransportSnapshotReader(workspaceType)` reads tour canonical → `PublicCatalogTransportSnapshot | undefined` for egress-safe catalog cards.
4. **Registration initializer dispatch** — generated portal bootstrap calls workspace `registrationInitializer` export when `capabilities.registrationInitializer` (replaces hand-wired `transportInitializerExport` table).
5. **Intake transport surface dispatch** — portal/catalog intake resolves `catalogIntakeTransportSurface` binding when `capabilities.registrationIntake`; host never branches on `pluginId === "denali"`.
6. **Registration normalize dispatch** — API registration handler invokes generated `resolveRegistrationTransportNormalizer(workspaceType)` when `capabilities.registrationNormalize` (structural presence check only at capability stage; product rules in normalizer module).
7. **List projection contract** — when `capabilities.listProjection`, host maps normalized intake `transport.kind` → `transportKind` scalar on booking list/detail DTOs (existing OpenAPI contract).
8. **Capability validation hook point (CW8)** — when enabled, capability stage validates snapshot shape + registration payload **structural** conformance (known kind enum, occupants range when kind requires); dong/personal-car **eligibility** stays workspace normalizer/policy.
9. **Isolation default** — absent block or `supported: false` → none of the above activates.

**Explicit non-goals (generic layer MUST NOT — TRUTH §24; plan non-goal #6):**

- Ship platform default transport mode vocabulary (`bus`, `shared_cars`, dong, personal-car) as tour-core rules
- Encode Denali dong amount visibility (`transportDongVisible`) or personal-car opt-in (`allowPersonalCar`) in neutral core
- Copy `normalizeDenaliRegistrationTransportIntake` logic into tour-core / workspace-sdk
- Define customer vehicle policies or default `primary` vs `personal_car` semantics in host `if (workspaceType)` branches
- Auto-enable transport intake for all outdoor-profile workspaces
- Move tour canonical transport persistence out of host tour document storage

---

## 5. Denali policy and data ownership (Q2)

| Concern | Generic / host | Denali-owned (adapter) |
|---------|----------------|------------------------|
| Tour canonical `transport.*` storage | Host tour document persistence + RLS | Field paths, zod kinds, wire mapping (`tripDetails.transport`) |
| Transport mode enum on wizard | Field-registry + composite **seams** | `transportMode` zod kind; modes `bus`, `minibus`, `train`, `shared_cars`, `private_car`, `none` |
| Contextual visibility/required | Field-policy engine dispatch | `transportDongVisible`, `transportPersonalCarOptionVisible`, `transportTrainSeatVisible`, … |
| Wizard composite UX | Composite registry dispatch | `denali.transport-mode` + dependents (`dongAmount`, `seatPreference`, …) |
| Catalog egress snapshot | `PublicCatalogTransportSnapshot` **shape** in SDK | `readDenaliCatalogTransportSnapshot` — which canonical paths populate snapshot |
| Portal intake UI/state machine | `WorkspaceCatalogIntakeTransportSurface` **hook shape** | `denaliCatalogTransportIntakeSurface` — personal-car opt-in, dong radios, price hints |
| Registration transport kinds | `PublicCatalogRegistrationTransportKind` wire enum in SDK | When each kind applies; `normalizeDenaliRegistrationTransportIntake` rules |
| Dong semantics | Normalizer **dispatch** only | `isDenaliIntakeDongOffered`, `no_car_dong` only when `dongAmount > 0` |
| Personal-car rules | Intake surface **dispatch** | `showPersonalCarOptIn`, occupants 1–3, `allowPersonalCar` gating |
| Publish readiness (transport leaves) | CW8 `workspacePolicyValidation` stage | Denali publish matrix / contextual required rules |
| Marketing logistics presentation | `catalogDetailSection` gate | Denali catalog UI copy, IRR/toman display (workspace config) |
| List `transportKind` scalar | Host projection + OpenAPI | Denali intake kinds map 1:1 to roster vocabulary today |
| Registration initializer | Codegen calls binding | `registerDenaliCatalogRegistrationTransportInitializer` |

**Boundary rule:** generic codegen knows **whether** transport surfaces exist and **where** workspace modules bind; Denali packages own **what** modes, dong, personal-car, and price composition mean.

---

## 6. Persistence ownership statement

| Layer | Owns | Does not own |
|-------|------|----------------|
| **Host API** (`apps/api`) | Tour canonical document JSON; registration intake JSON on booking rows; `transportKind` list scalar; catalog card egress assembly | Transport mode labels, dong eligibility, personal-car UX |
| **Workspace package** | Snapshot reader, intake surface, normalizer, field fragments, wizard composite | Database schema for transport (no dedicated table) |
| **tour-core** | — | Transport product rules (forbidden) |
| **workspace-sdk** | `PublicCatalogTransportSnapshot`, intake hook types, registration kind enum | Persistence, Denali defaults |

### 6.1 Tour canonical contract

- Operator configures transport on tour documents via workspace-defined canonical paths (Denali: `transport.mode`, `transport.transportCost`, `transport.allowPersonalCar`, `transport.dongAmount`, …).
- Wire projection to API DTOs / trip details follows workspace field registry — host does not hard-code Denali paths.
- No `workspace_transport` reference table (contrast: equipment `workspace_equipment`).

### 6.2 Registration intake contract

- Member choice persists on registration intake as workspace-normalized payload (Denali: `{ kind, personalCarOccupants? }`).
- Default kind when intake omitted: workspace normalizer decides (Denali: `primary` for organized transport).
- List projection reads `transport.kind` from stored intake → `transportKind` scalar.

### 6.3 Catalog snapshot contract (registration binding)

Egress-safe snapshot on catalog cards (`PublicCatalogTransportSnapshot`):

```ts
{
  mode: PublicCatalogTransportMode;  // organizer_vehicle | bus | minibus | train | shared_cars | none
  allowPersonalCar?: boolean;
  transportCostAmount?: number | null;
  dongAmount?: number | null;
}
```

- **Reader binding** (`catalogSnapshotReader`) maps tour canonical → snapshot; omitted when `capabilities.catalogSnapshot` false.
- Snapshot is **tour-authored** (operator), not member registration state.
- Portal registration flow receives `context.tourTransport` from catalog card; initializer binding hydrates intake state.

---

## 7. Field-registry integration seam

Transport tour fields are **not** platform-global. Workspace adapter supplies optional bindings:

| Binding | Purpose | Denali reference |
|---------|---------|------------------|
| `fieldModule` | Field-registry fragment (`transport.*` rows, zod kinds, wire rules) | CW7-07 — `denaliFieldRegistryData` transport section |
| `wizardComposite` | Composite renderer for mode anchor + dependents | `denali.transport-mode` in `denali-composite-registry.ts` |
| `zodKind: transportMode` | Workspace-owned Zod + hydration | Denali transport mode enum + clone behavior |

**Integration flow (CW7-07):**

```text
workspaceTransport.capabilities.wizardTourField === true
  → codegen emits field fragment import
  → platform wizard merges fragment into workspace field registry
  → composite registry resolves transport-mode via wizardComposite binding
  → canonical write path projects transport leaves to tripDetails (Denali wire)
```

**When capability absent:** no `transport.*` field rows; wizard steps omit transport composite; tour documents may omit transport section entirely.

---

## 8. Workspace adapter responsibility

The **workspace adapter** (e.g. Denali package) owns all product semantics the generic capability does not define:

| Responsibility | Adapter module (Denali) | Generic never does |
|----------------|-------------------------|-------------------|
| Declare manifest `workspaceTransport` block + bindings | `workspace.manifest.json` | Auto-enable for outdoor workspaces |
| Catalog snapshot reader | `read-denali-catalog-transport.ts` | Default mode mapping |
| Portal intake surface | `denali-catalog-transport-intake.ts` | Generic dong/personal-car UI |
| Registration normalizer | `resolve-denali-registration-transport.ts` | Host `if (denali)` branches |
| Registration initializer | `register-transport-initializer.ts` | Hard-coded portal initializer table |
| Wizard transport UX | `denali-transport-mode-field`, composite registry | Generic transport picker |
| Publish / draft validation policy | `validatePublishReadiness`, publish matrix | Dong-required rules in tour-core |
| Marketing logistics copy | catalog presentation components | Denali mode labels as platform i18n |
| Transport kind vocabulary | `DenaliRegistrationTransportKind` schema | Platform default kinds beyond wire enum |

**Host API adapter surface:** workspace type → generated bindings (`resolveCatalogTransportSnapshotReader`, `resolveRegistrationTransportNormalizer`, capability flags). Host **never** imports Denali transport modules directly except via generated files.

---

## 9. Codegen / registration seam (CW7-06 targets)

| Generated artifact | Source field |
|--------------------|--------------|
| `packages/workspace-sdk/src/catalog/workspace-transport-capabilities.generated.ts` | capability flags per workspace |
| `packages/workspace-plugin-host/src/workspace-registration-transport-initializers.generated.ts` | `workspaceTransport.registrationInitializer` (replaces `catalogRegistrationFlow.transportInitializerExport`) |
| `packages/workspace-sdk/src/catalog/catalog-transport-snapshot-readers.generated.ts` | `catalogSnapshotReader` dispatch |
| `packages/workspace-sdk/src/catalog/catalog-intake-transport-surfaces.generated.ts` | `catalogIntakeTransportSurface` dispatch (optional thin resolve) |
| `apps/api/src/catalog/registration-transport-normalizers.generated.ts` | `registrationTransportNormalizer` dispatch |
| `apps/api/src/tours/workspace-capability-validation-bindings.generated.ts` | extend CW8-02 — `workspaceTransport` stage hook |
| Domain index entry in `workspace-registry-codegen-modularization.mdoc` | `workspaceTransport` domain module |

**Coordinator-owned:** orchestrator domain `transport.mjs` (new), manifest schema promotion.

**Registration mechanism:** `pnpm run generate:workspace-registry` after manifest change; `--check` determinism; transport domain emits only rows for `supported: true` workspaces.

**Legacy compat (CW7-06):** `registration.mjs` reads `workspaceTransport.registrationInitializer` first; if absent, fall back to `catalogRegistrationFlow.transportInitializerExport` (Denali transition).

---

## 10. Validation seam (static + runtime)

### 10.1 Codegen / manifest validation

- If `supported: true` and `capabilities.catalogSnapshot` → require `catalogSnapshotReader`.
- If `capabilities.registrationIntake` → require `catalogIntakeTransportSurface`.
- If `capabilities.registrationInitializer` → require `registrationInitializer` (portal hydration).
- If `capabilities.registrationNormalize` → require `registrationTransportNormalizer`.
- If `capabilities.wizardTourField` → require `fieldModule` + `wizardComposite`.
- If `supported: false` → forbid non-empty binding objects (fail or warn per strict mode).
- `registrationIntake: true` without `catalogSnapshot` → warn (intake needs tour snapshot).
- Module paths: `./catalog/*` for snapshot/intake; `./http/*` for normalizer; `./field-registry/*` for field module (guard parity with equipment settings paths).

### 10.2 Runtime validation — CW8 `capabilityValidation` stage

| Check | Stage | Owner |
|-------|-------|-------|
| Snapshot `mode` is known `PublicCatalogTransportMode` | capability when `workspaceTransport` | generic structural |
| Registration `kind` ∈ `PublicCatalogRegistrationTransportKind` | capability when `registrationNormalize` bound | generic structural |
| `personalCarOccupants` ∈ 1..3 when kind requires | capability | generic structural |
| Dong kind forbidden when snapshot `dongAmount` missing/`≤ 0` | **workspacePolicyValidation** or normalizer | Denali product rule |
| Personal-car opt-in only when snapshot `allowPersonalCar` | normalizer / intake surface | Denali product rule |
| Publish-time transport leaf required (dong, seat) | **workspacePolicyValidation** | Denali publish matrix |
| Urban forbidden transport modes on trip details | **workspacePolicyValidation** | Urban policy module |

**CW8 pipeline mapping:**

```text
capabilityValidation:
  { capabilityId: "workspaceTransport", run: runTransportCapabilityValidation }
    → structural snapshot + intake kind checks only

workspacePolicyValidation:
  → Denali publish matrix transport leaves
  → Urban checkTripDetails transport mode restrictions
  → normalizeDenaliRegistrationTransportIntake throws (product invalid) — surfaced as workspace violation
```

**Does not include in capability stage:** dong visibility rules, personal-car eligibility, Denali `shared_cars` mandatory follow-up — those remain workspace adapter + policy.

---

## 11. UI seams

| Surface | Gate | Binding |
|---------|------|---------|
| Operator tour wizard | `capabilities.wizardTourField` + `fieldModule` + `wizardComposite` | field registry + `denali.transport-mode` composite |
| Catalog list/detail card | `capabilities.catalogSnapshot` | `catalogSnapshotReader` → `transport` on card |
| Marketing logistics section | `capabilities.catalogDetailSection` | presentation pipeline + snapshot |
| Portal registration follow-up | `capabilities.registrationIntake` + `catalogIntakeTransportSurface` | intake transport hooks + schema `transportIntake` feature |
| Portal flow state hydration | `capabilities.registrationInitializer` | registration initializer export |
| Operator bookings list | `capabilities.listProjection` | `transportKind` scalar |
| Portal member amend (transport) | `capabilities.registrationNormalize` + workspace HTTP allowlist | Denali amend service today |

---

## 12. Isolation semantics (capability absent)

When `workspaceTransport` is absent or `supported: false`:

| Layer | Expected behavior |
|-------|-------------------|
| Codegen | No row in transport capability flags, snapshot readers, initializers, normalizers |
| Wizard | No `transport.*` field rows; no transport composite in step manifest |
| Catalog cards | No `transport` field on public catalog tour DTO |
| Marketing | No transport logistics section gate |
| Portal registration | No transport initializer registration; no transport follow-up UI; `features.transportIntake` ignored for codegen |
| API registration | No workspace transport normalizer dispatch; intake `transport` omitted or passed through workspace-agnostic path |
| List projection | `transportKind: null` |
| tour-core | No transport-specific capability ports invoked |

**CW7-08 proof targets:** `starter`, `guest-club`, `urban` manifests — zero transport surfaces; Denali parity unchanged after CW7-07 migration.

---

## 13. Relationship to profile composition (CW6)

`starter-outdoor` profile does **not** enable transport by default. Transport is opt-in via workspace manifest:

```json
"workspaceTransport": { "supported": true, ... }
```

Profile `capabilityDefaults` may include `workspaceTransport: { "supported": false }` explicitly; must not inject Denali transport bindings.

---

## 14. Generic vs Denali ownership summary

| Dimension | Generic MAY | Generic MUST NOT (Denali owns) |
|-----------|-------------|--------------------------------|
| Capability on/off | `supported`, per-surface flags | — |
| Snapshot seam | `PublicCatalogTransportSnapshot` shape + reader dispatch | Mode vocabulary defaults; dong/personal-car fields meaning |
| Registration binding | Initializer + normalizer dispatch slots | `primary` default rules; shared_cars mandatory follow-up |
| Field/module registration | `fieldModule`, `wizardComposite` seams | `transport.*` canonical paths and zod kinds |
| Validation registration | Structural kind/occupants checks in capability stage | Dong eligibility, personal-car policy, publish matrix |
| Persistence contract | Tour canonical JSON + intake JSON + list scalar | Denali wire paths as platform defaults |
| UI seam | Gate flags + dispatch to workspace modules | Denali transport-mode composite UX |
| Customer vehicle policies | — | Personal car, dong, acquaintance semantics |
| Transport option vocabulary | Wire enum types only (SDK) | Denali mode labels, organized vs shared_cars product rules |

---

## 15. Tests required (CW7-06+)

| Test | Scope |
|------|-------|
| `workspace-transport-codegen.spec.mjs` | manifest → capability flags + initializer + snapshot reader bindings |
| `cw7-08-transport-isolation.spec.mjs` | starter / guest-club / urban → no transport codegen surface |
| `denali-catalog-transport-intake.spec.ts` | parity after binding migration (existing) |
| `resolve-denali-registration-transport.spec.ts` | parity after normalizer dispatch (existing) |
| `portal-registration-transport-smoke.spec.ts` | DEN-TRANS-01..03 — no `pluginId === "denali"` in portal (existing) |
| `denali-transport-pipeline-parity.golden.spec` | CW7-07 — field fragment + wizard composite |
| `cw8-transport-capability-validation.spec.ts` | capability stage structural checks only |
| Extend `denali-coupling.contract.spec.ts` | CW7-15 — capability packages ≠ Denali transport ids |

---

## 16. Required future schema / codegen changes (coordinator-owned)

| File | Change |
|------|--------|
| `packages/workspace-sdk/src/manifest.schema.ts` | `workspaceTransport` Zod block (coordinator) |
| `scripts/codegen/workspace-registry/domains/transport.mjs` | **New** domain — capability flags, snapshot reader, initializer, intake surface, normalizer |
| `scripts/codegen/workspace-registry/orchestrator.mjs` | Register `transport` domain |
| `scripts/codegen/workspace-registry/domains/registration.mjs` | Read `workspaceTransport.registrationInitializer` vs legacy `transportInitializerExport` |
| `packages/workspaces/denali/workspace.manifest.json` | Migrate to `workspaceTransport` block (CW7-07) |
| `docs/dev/guest-plugin-conformance.md` | Document block + alias deprecation |
| `docs/dev/workspace-registry-codegen-modularization.mdoc` | Domain table row |
| `docs/phase-10/subphases/10.2-manifest-codegen.md` | Update transport initializer source field |

**CW7-05 does not modify these files** — Worker implements at CW7-06+.

---

## 17. CW7-05 closure checklist

| Item | Status |
|------|--------|
| Manifest shape | ✅ `workspaceTransport` block + bindings |
| Configuration shape | ✅ §3.1 capabilities + module bindings |
| Enabled/disabled semantics | ✅ §3.3 master switch + per-surface flags |
| Runtime/codegen binding | ✅ §9 + legacy alias path |
| Persistence ownership | ✅ §6 tour canonical + intake + list scalar |
| Registration snapshot contract | ✅ §6.3 `PublicCatalogTransportSnapshot` |
| Validation seam | ✅ §10 + CW8 stage mapping |
| UI seams | ✅ §11 |
| Field-registry integration | ✅ §7 |
| Workspace adapter responsibility | ✅ §8 |
| Absent-capability / isolation | ✅ §12 + CW7-08 |
| Generic vs Denali (Q1/Q2) | ✅ §4–5, §14 |
| TRUTH §24 MUST-NOT honored | ✅ §4 non-goals |
| Implementation deferred | ✅ CW7-06+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-05-workspace-transport-contract.md`.*
