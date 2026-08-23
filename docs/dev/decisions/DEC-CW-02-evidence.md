# DEC-CW-02 — Archive: generic lifecycle state vs workspace/vertical capability

**Decision id:** DEC-CW-02  
**Status:** PROPOSAL (awaiting Architect + Tour product owner)  
**Prepared:** 2026-08-23 (CW Wave 3A, Worker D)  
**Repository ref:** `7d3daac6` (main)  
**Canonical ledger:** [`docs/dev/composable-workspace-refactor-plan.md`](../composable-workspace-refactor-plan.md) — DEC-CW-02 section

---

## 1. Decision question

Should **archive** become part of the **generic Tour lifecycle** in neutral tour-core / SDK lifecycle contracts, or remain outside that graph as a **workspace/vertical policy** expressed through visibility and list-projection adapters?

**Constraint:** smallest architecture that does **not** force Denali behavior to change.

---

## 2. DEC-CW-02 RECOMMENDATION (PROPOSAL for Architect)

**Recommend Option D — neutral visibility concept without generic archive semantics**, with **Option B optional capability** for workspaces that need archive (Urban today).

| Layer | Contract |
|-------|----------|
| **tour-core / SDK (neutral)** | `TourPublishVisibilityPort.isPubliclyVisible(canonical) → boolean` only. No `ARCHIVED` lifecycle enum. Non-visible canonical labels map to `notPublished` bucket in CW3-05 wire mapping. |
| **Workspace (optional)** | Manifest capability `tourArchivePolicy` (name TBD at CW5-04) declaring: canonical archive label (`archived`), allowed transitions, operator-only delete semantics. **Absent** on Denali/Starter/Harbor until product requests. |
| **List projection (SDK output)** | Existing `TourListStatus.archived` / `TourUiStatus.archived` remain **projection chips** emitted only by workspaces with `tourArchivePolicy`. |
| **Host operator filter** | Keep host aggregation `publishStatus IN ('closed','cancelled','archived')` for legacy API bucket — not a lifecycle graph node. |

**Reject Option A** unless product owner signs Denali archive requirement **and** Urban transition matrix **and** accepts CW0-02 golden expansion for archive edges.

**Rationale (smallest, Denali-safe):**

1. Archive is **catalog visibility + operator retention**, not publish/unpublish — Urban already treats `archived` as **not published** (`isUrbanTourPublished` false) while list projection shows an `archived` chip.
2. CW0-02 parity floor has **zero archive cases** — generic lifecycle `ARCHIVED` would be new semantics, not refactor preservation.
3. Denali outdoor product has **no archive path** by design today; TRUTH §6 classifies Urban archive as intentional vertical variation.
4. CW3-01 visibility port already answers the cross-workspace question ("is this tour public?") without vocabulary collapse.

---

## 3. Current semantics per workspace

### 3.1 Urban (events vertical) — archive implemented

| Surface | Behavior | Evidence |
|---------|----------|----------|
| **Canonical vocabulary** | `tour.publishStatus`: `draft` \| `published` \| `archived` (field enum) | `urban/internal.ts` L186–192; `URBAN-PRODUCT-SCOPE.md` §field table |
| **DB constraint** | `publish_status IN ('draft','published','archived')` | `infra/sql/009_urban_product_delta.sql`; Prisma migration |
| **Publish transition detector** | Types `draft` \| `published` only; `normalizeUrbanPublishStatus` **drops** `archived` | `urban-tour-publish-transition.ts` L6–26 |
| **Public catalog visibility** | `isUrbanTourPublished` → `publishStatus === "published"` only | `urban/http/publish-status.ts` L15–23 |
| **Public catalog list** | `filterWorkspacePublishedTours` + `isUrbanTourPublished` — archived **excluded** | `urban/http/catalog.service.ts` L90–93 |
| **Registration gate** | `requireWorkspacePublishedTour` + `isUrbanTourPublished` — archived **rejects** intake | `urban/http/registration.service.ts` L47 |
| **Operator list projection** | `archived` → `{ listStatus: "archived", uiStatus: "archived" }` | `urban/list/tour-list-projection.ts` L50–52 |
| **Exposure surfaces** | `publicList` / `publicDetails` only run on published tours (pre-filtered) | `urban-exposure-surfaces.ts`; `workspace-exposure-plugin-contract.mdoc` |
| **Owner delete (spec)** | `DELETE /urban/admin/catalog/{tourId}` → soft-delete `publishStatus=archived`; owner-only | `URBAN-ROUTE-MATRIX.md` §D; `CASL-URBAN-OWNER-SPEC.md` §Tours |
| **Unarchive (spec/code)** | **Not defined** — no `archived → published` route or golden | Route matrix has `unpublish` → `draft` only |
| **Plugin lifecycle graph** | `DRAFT ↔ PUBLISHED` only — **no ARCHIVED node** | `urban/internal.ts` `URBAN_LIFECYCLE` L230–237 |
| **Tests** | List projection: published case only; CW0-02: draft→published, stable published | `urban/test/tour-list-projection.spec.ts`; CW0-02 urban fixture |

**Urban archive tension:** publish-transition layer treats `archived` as unpublished; list projection treats it as a distinct operator chip. This is **visibility + projection policy**, not a publish lifecycle edge.

### 3.2 Denali (outdoor vertical) — no archive

| Surface | Behavior | Evidence |
|---------|----------|----------|
| **Canonical vocabulary** | `publishStatus`: `draft` \| `active` only | `denali-publish-status-field.tsx` `PUBLISH_STATUS_VALUES` |
| **Plugin lifecycle graph** | `DRAFT → OPEN` only (canonical labels `draft`/`active` bridged at API) | `denali-plugin-build.ts` `DENALI_LIFECYCLE` |
| **Publish transition** | `draft ↔ active`; types `published` / `unpublished` | CW0-02 denali fixture; `denali-tour-publish-transition.ts` |
| **Public catalog visibility** | `isDenaliTourPublished` → `publishStatus === "active"` | `denali/catalog/denali-publish-status.ts` |
| **Operator list projection** | `active` → open/active; **anything else → draft** (including hypothetical `archived`) | `denali/list/tour-list-projection.ts` L51–58 |
| **Exposure / reminders** | Denali exposure surfaces (`public_list`, `reminder_feed`) on published/active tours | `denali-exposure.surface.ts`; TRUTH §6 |
| **Archive path** | **None** | TRUTH §6 |

### 3.3 Harbor — no archive

| Surface | Behavior | Evidence |
|---------|----------|----------|
| **Canonical vocabulary** | `draft` \| `published` (smoke fixtures) | CW0-02 harbor fixture |
| **Public visibility** | `isHarborTourPublished` → `status === "published"` | `harbor/catalog/to-harbor-catalog-card.ts` |
| **Archive** | **Not implemented** | TRUTH §6; Harbor grep empty |

### 3.4 Starter — no archive

| Surface | Behavior | Evidence |
|---------|----------|----------|
| **Lifecycle** | `DRAFT → OPEN` only | `starter-plugin-core.ts` `STARTER_LIFECYCLE` |
| **CW0-02** | `DRAFT→OPEN` allowed; `OPEN→DRAFT` disallowed | `starter-lifecycle-draft-open.json` |

### 3.5 Host cross-cutting

| Surface | Behavior | Evidence |
|---------|----------|----------|
| **API lifecycle gate** | `isPublishedPublishStatusLabel` recognizes `published`/`active` only; `archived` → `initialStatus` (not published) | `assert-tour-publish-lifecycle-gate.ts` L9–23 |
| **Operator list DB filter** | UI bucket `archived` → `publishStatus IN ('closed','cancelled','archived')` | `operator-tour-list-db-query.ts` L28–29 |
| **SDK list contract** | `TourListStatus` / `TourUiStatus` include `archived` as **projection output** | `tour-list-projection.contract.ts`; `TOURS-LIST-UX.md` §4.2 |
| **Persistence** | Archive = canonical JSON `publishStatus` on tour row; no archive table | TRUTH §6 |

---

## 4. Why Denali lacks archive

| Factor | Detail |
|--------|--------|
| **Product model** | Outdoor trips use **draft/active** (open for booking) vs **draft** (wizard/editing). Seasonal close-out and trip completion are not modeled as a third publish label — operators unpublish to `draft` or leave `active` until departure passes. |
| **Wizard / field registry** | Denali publish UI exposes only `["draft", "active"]` — no archive enum option in operator create/edit surfaces. |
| **Lifecycle graph** | `DENALI_LIFECYCLE` is two-state (`DRAFT`/`OPEN`); no terminal retention state. |
| **List projection** | Non-`active` canonical publish labels collapse to **draft** chip — there is no operator "archived" bucket in Denali UX. |
| **TRUTH classification** | §6 divergence reason: Urban = `intentional product variation` (events archive); Denali = `incomplete implementation` on archive **only if** archive were assumed platform-generic — evidence supports **absence by product scope**, not a bug to fix in CW refactor. |
| **Exposure / reminders** | Denali reminder scheduler and catalog loaders gate on **active/published** tours; no archive branch needed because label does not exist. |
| **Refactor non-goal** | Ledger item #14: do not make archive generic before DEC-CW-02 — Denali must not gain archive semantics implicitly. |

**Conclusion:** Denali lacks archive because the outdoor vertical never defined a post-active retention label. Forcing generic `ARCHIVED` lifecycle would be a **Denali product change**, not parity preservation.

---

## 5. CW0-02 publish-transition parity

**Harness:** `test/parity/publish-transition.golden.spec.mjs`  
**Aggregate fixture:** `test/parity/fixtures/publish-transition/workspace-publish-transitions.json`  
**Status:** `[x]` CW-0 complete (2026-08-23)

| Workspace | Golden cases | Archive covered? |
|-----------|--------------|------------------|
| Denali | `draft→active`, `active→draft`, stable draft, nested `basicInfo` | **No** |
| Urban | `draft→published`, published stable | **No** |
| Harbor | flat + nested `tour.status` draft→published | **No** |
| Starter | `DRAFT→OPEN`, `OPEN→DRAFT` disallowed, publish flag | **No** |

**Gaps (intentionally outside parity floor):**

- Urban `published → archived`, `archived → published`, `archived` stable
- Any Denali/Harbor/Starter archive transition

**Implication for DEC-CW-02:** Archive is **outside** CW0-02. `assertTourPublishLifecycleOnUpdate` outcomes for existing golden pairs must remain byte-identical (CW3-06 invariant). Adding generic `ARCHIVED` to `WorkspaceLifecycleContract` would require new goldens and risks Denali/Harbor/Starter lifecycle graph changes.

**Urban publish-transition vs archive:**

```text
isUrbanTourPublished("archived") === false   // transition layer: unpublished
listStatus("archived") === "archived"        // projection layer: distinct chip
```

---

## 6. Public visibility, catalog, and exposure

### 6.1 Visibility (all workspaces)

| Workspace | Publicly visible when | Archived visible? |
|-----------|----------------------|-------------------|
| Denali | `publishStatus === "active"` | N/A |
| Urban | `publishStatus === "published"` | **No** — same as draft for egress |
| Harbor | `publishStatus/status === "published"` | N/A |

Mechanism: workspace `isPublished` predicate → `filterWorkspacePublishedTours` / `loadWorkspaceTourIfPublished` (`workspace-catalog-list.ts`).

### 6.2 Urban catalog (spec + implementation)

| Concern | Behavior |
|---------|----------|
| Public `GET /urban/catalog` | Published tours only; city filter; exposure-aware cards | `catalog.service.ts`; `URBAN-ROUTE-MATRIX.md` §B |
| Public detail | 404/null when not published | `getUrbanCatalogTour` |
| Admin `GET /urban/admin/catalog` | Draft + published (spec: all non-archived statuses for owner admin list) | `URBAN-ROUTE-MATRIX.md` §D |
| Owner delete | Spec: soft-delete → `archived` (route in charter; implementation deferred Phase 8 guards) | `URBAN-ROUTE-MATRIX.md` §D; `phase-8-charter-deferred.mjs` |
| Unpublish | `POST .../unpublish` → `draft` (not `archived`) | Route matrix §E |

### 6.3 Exposure specs

Per `workspace-exposure-plugin-contract.mdoc` and `field-exposure-system.md`:

- Exposure answers **which fields appear on a publication surface** for an audience/trigger.
- Workspace plugins declare surface defaults (`exposureSurface` on plugin).
- Urban: `publicList`, `publicDetails` — applied only after publish filter (`applyWorkspaceCatalogCardExposure`).
- Denali: `public_list`, `reminder_feed` — gated on active/published catalog loaders.
- **Archive does not define an exposure surface** — archived tours are excluded upstream by visibility predicate before exposure resolution runs.

### 6.4 Registration

`requireWorkspacePublishedTour` blocks when `isPublished` is false. Urban archived tours: **registration closed** (equivalent to draft).

### 6.5 Restore / unarchive semantics

| Question | Current answer |
|----------|----------------|
| `archived → published` supported? | **No code path**; no CW0-02 golden; no route in matrix |
| `archived → draft`? | **No** — unpublish route targets `draft` from `published` only |
| Operator restore UX? | **Underspecified** — product question for Urban owner |
| Denali restore? | N/A |

---

## 7. Operator list projection

| Workspace | Publish labels | `listStatus` / `uiStatus` mapping |
|-----------|----------------|-----------------------------------|
| Denali | `draft`, `active` | `active` → `open`/`active`; else → `draft`/`draft` |
| Urban | `draft`, `published`, `archived` | `published` → `published`/`active`; `archived` → `archived`/`archived`; else → `draft`/`draft` |

**Host filter bridge:** Web operator `?status=archived` queries DB `publishStatus IN ('closed','cancelled','archived')` — aggregates legacy labels not used by current Denali/Urban canonical enums but preserves API bucket compatibility (`TOURS-LIST-UX.md` §status filter table).

**CW3-07 invariant:** operator list chips byte-identical after dispatch migration — Urban keeps `archived` chip; Denali unchanged.

---

## 8. DB / state representation

| Aspect | Representation |
|--------|----------------|
| Storage | Single `tours.publish_status` column + canonical JSON `data.tour.publishStatus` (Urban nested) |
| Urban constraint | `CHECK (publish_status IN ('draft','published','archived'))` |
| Denali | No `archived` in wizard enum or DB check specific to Denali workspace |
| Separate archive table | **None** (TRUTH §6) |
| Outbox on archive | **None** — no `TourArchived` event; publish outbox fires only on publish transition (CW0-04) |

---

## 9. Options comparison

### Option A — Generic Tour lifecycle state

Add `ARCHIVED` to neutral `WorkspaceLifecycleContract` / tour-core lifecycle enum; CW3-05 maps all workspace archive labels; CW5-04 encodes archive in publish orchestration ports.

| Pros | Cons |
|------|------|
| Single enum for OpenAPI, operator filters, transition tables | **Forces Denali product decision** — must add archive or stub unreachable state |
| Symmetric CW9 archive assertions | Violates ledger non-goal #14; CW0-02 expansion required |
| | Urban `archived` is not a publish edge today — invent transitions without sign-off |
| | Harbor/Starter need stub states |

**Risk:** HIGH. **Denali impact:** behavior change required.

### Option B — Optional capability

Manifest block `tourArchivePolicy` (or similar); Urban binds; others omit. Core exposes visibility + not-published bucket only.

| Pros | Cons |
|------|------|
| Explicit certification per workspace | Extra manifest/codegen surface |
| Denali unchanged until product opts in | Capability contract must define transitions if multiple archive workspaces |
| CW9-05 scoped to capability holders | |

**Risk:** LOW–MEDIUM. **Denali impact:** none (default absent).

### Option C — Workspace/vertical policy state

Archive vocabulary and transitions live entirely in workspace field enums + policy modules; neutral core has no archive concept; host lifecycle gate unchanged.

| Pros | Cons |
|------|------|
| Maximum workspace autonomy | Weaker cross-workspace discoverability for CW-7/CW-9 |
| Denali untouched | Archive transition through `assertTourPublishLifecycleOnUpdate` remains undefined for Urban PATCH → archived |
| | Overlaps B and D without crisp tour-core contract |

**Risk:** MEDIUM. **Denali impact:** none.

### Option D — Neutral visibility without generic archive semantics (RECOMMENDED core)

tour-core/SDK: `isPubliclyVisible` boolean + `notPublished` label bucket in CW3-05 mapping. `archived` is never a lifecycle graph node. List projection `archived` chip is workspace adapter output.

| Pros | Cons |
|------|------|
| **Smallest** cross-workspace contract | Operator filter still host-aggregated |
| Denali/Harbor/Starter need zero archive work | Urban must own archive policy module (pair with Option B) |
| Aligns with CW3-01 `TourPublishVisibilityPort` design | |
| CW0-02 parity preserved | |
| Archive = visibility/retention, not publish/unpublish | |

**Risk:** LOW. **Denali impact:** none.

### Option matrix summary

| Option | Denali forced change? | CW0-02 safe? | Smallest? |
|--------|----------------------|--------------|-----------|
| A | **Yes** | No | No |
| B | No | Yes | Medium |
| C | No | Yes | Medium |
| D (+ B for Urban) | **No** | **Yes** | **Yes** |

---

## 10. Impact on CW3-05 and CW5-04

### 10.1 CW3-05 — neutral publish-label mapping table

| If DEC-CW-02 = D (+ B) | Action |
|------------------------|--------|
| Mapping table rows | `active`/`published` → `published` visibility bucket; `draft` → `draft`; `archived` → **`notPublished`** (placeholder row, Urban-only source label) |
| Denali | `active` → published bucket; no `archived` row |
| Manifest | `publishLabelMapping` per workspace; optional `tourArchivePolicy.canonicalLabel: "archived"` |
| Blocker removed? | **Yes** — archive-row final semantics = `notPublished` + workspace list projection emits `archived` chip |
| Invariant | No global rename; wire vocabulary preserved |

### 10.2 CW5-04 — publish orchestration port set

| If DEC-CW-02 = D (+ B) | Action |
|------------------------|--------|
| Ports formalized | `TourPublishVisibilityPort`, label mapping dispatch, transition detection (CW0-02 scope only) |
| **Excluded from tour-core enum** | `ARCHIVED`, `archiveTransition`, global archive lifecycle state |
| Optional extension port | `TourArchivePolicyPort` (workspace-bound): `isArchived`, `allowedArchiveTransitions`, `canRestore` — only when manifest declares capability |
| Certification | CW5-11 tour-core cert: no archive enum; CW9-05 archive assertions only on capability workspaces |
| Blocker | CW5-04 **archive enumeration** deferred until DEC-CW-02 — with Option D, enumeration is **explicitly out of scope** for tour-core; closes without global enum |

---

## 11. Future workspace impact

| Scenario | Guidance under D + B |
|----------|---------------------|
| New events vertical (like Urban) | Declare `tourArchivePolicy`; reuse Urban adapter patterns; certify archive transitions in workspace package |
| New outdoor vertical (like Denali) | Omit capability; `draft`/`active` only; list projection no `archived` chip |
| Harbor gains archive | Opt-in capability; define `published → archived` product rules before CW9 assertion |
| Cross-workspace operator UI | Host filter `archived` bucket unchanged; projection chips workspace-specific |
| Exposure on archive | No new surface — archived remains non-visible; field exposure unchanged |
| Compliance retention | Workspace policy may forbid hard delete; archive label = soft-delete — not platform lifecycle |

---

## 12. Exact contract proposed (if Architect approves D + B)

### 12.1 Neutral core (`@app-tour/tour-core` / SDK re-export)

```typescript
/** CW3-01 / CW5-04 — cross-workspace public visibility only */
export interface TourPublishVisibilityPort {
  isPubliclyVisible(canonical: CanonicalDocument): boolean;
}

/** CW3-05 wire mapping — no archive enum */
export type TourPublishVisibilityBucket = "published" | "notPublished";

export interface TourPublishLabelMapping {
  readonly canonicalLabel: string;
  readonly visibilityBucket: TourPublishVisibilityBucket;
}
```

### 12.2 Optional workspace manifest (Urban binds; Denali omits)

```typescript
/** Workspace capability — not part of WorkspaceLifecycleContract */
export interface TourArchivePolicyManifest {
  readonly capability: "tourArchive";
  readonly canonicalArchiveLabel: string; // Urban: "archived"
  readonly module: string;
  readonly exports: {
    readonly isArchived: string;
    readonly extractArchiveListStatus: string;
  };
  /** Product-defined; not in tour-core until signed */
  readonly allowedTransitions?: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
  }>;
}
```

### 12.3 Invariants

1. `WorkspaceLifecycleContract` remains **publish graph only** (`initialStatus`, `publishStatus`, `allowedTransitions`) — no `ARCHIVED` state.
2. `isPubliclyVisible` is the **only** cross-workspace gate for catalog, registration, and exposure pre-filter.
3. `TourListStatus.archived` is a **projection output**, not a lifecycle node.
4. Denali manifest **must not** declare `tourArchive` unless product owner signs outdoor archive requirement.
5. CW0-02 golden pairs remain byte-identical; archive transitions added only via **new** workspace-scoped goldens after product sign-off.
6. Urban `archived` maps to `notPublished` in CW3-05 table; list projection continues `archived`/`archived` chip mapping.

### 12.4 Urban archive transition matrix (product TBD — not encoded in tour-core)

| Edge | Spec/code today | Proposed default if capability approved |
|------|-----------------|----------------------------------------|
| `published → archived` | Spec (`DELETE` admin catalog); no CW0-02 golden | Owner-only; no public visibility change (already unpublished predicate) |
| `archived → published` | **Undefined** | **Deny** until product signs restore requirement |
| `draft → archived` | **Undefined** | **Deny** — archive only from published |
| Side effects | None coded | Cancel registrations TBD; no `TourArchived` outbox until product defines |

---

## 13. Downstream tasks

| Task | Block / guidance |
|------|------------------|
| **CW3-05** | Unblocked with `archived → notPublished` placeholder under Option D |
| **CW3-07** | Urban `archived` chip preserved; Denali unchanged |
| **CW5-04** | Formalize visibility + mapping + transition ports; **exclude** global archive enum |
| **CW9-05** | Archive assertions scoped to `tourArchive` capability workspaces only |

**Does not block:** CW0-*; CW1-*; CW2-*; CW3-01..04, CW3-06..09; CW4-*; CW5-01..03, CW5-06..11; CW6-*; CW7-*; CW8-*; CW9-01..04, CW9-06..10.

---

## 14. Open questions for decision owners

1. **Denali archive:** Permanent omission or future outdoor retention label?
2. **Urban restore:** Is `archived → published` required for operator workflow?
3. **Urban DELETE route:** Implement soft-delete per route matrix before or after CW-5?
4. **Harbor:** Draft/published only forever, or events-style archive later?
5. **Outbox:** Should archive emit `TourArchived` / `TourUnarchived` events (CW0-04 extension)?

---

## 15. Evidence index

| Artifact | Path |
|----------|------|
| TRUTH archive §6 | `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` |
| CW0-02 aggregate fixture | `test/parity/fixtures/publish-transition/workspace-publish-transitions.json` |
| CW0-02 parity spec | `test/parity/publish-transition.golden.spec.mjs` |
| Urban product scope | `docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md` |
| Urban route matrix (delete/archive) | `docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md` |
| Urban CASL owner spec | `docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md` |
| Exposure plugin contract | `docs/dev/workspace-exposure-plugin-contract.mdoc` |
| Field exposure system | `docs/architecture/field-exposure-system.md` |
| Operator list UX | `docs/phase-9/appendices/TOURS-LIST-UX.md` |
| Urban list projection | `packages/workspaces/urban/src/list/tour-list-projection.ts` |
| Urban publish visibility | `packages/workspaces/urban/src/http/publish-status.ts` |
| Urban catalog service | `packages/workspaces/urban/src/http/catalog.service.ts` |
| Urban publish transition | `packages/workspaces/urban/src/tours/urban-tour-publish-transition.ts` |
| Urban lifecycle | `packages/workspaces/urban/src/internal.ts` (`URBAN_LIFECYCLE`) |
| Denali list projection | `packages/workspaces/denali/src/list/tour-list-projection.ts` |
| Denali publish visibility | `packages/workspaces/denali/src/catalog/denali-publish-status.ts` |
| Denali lifecycle | `packages/workspaces/denali/src/denali-plugin-build.ts` |
| Denali publish UI enum | `packages/workspaces/denali/src/ui/fields/denali-publish-status-field.tsx` |
| API lifecycle gate | `apps/api/src/canonical/assert-tour-publish-lifecycle-gate.ts` |
| Operator archived filter | `apps/api/src/tours/operator-tour-list-db-query.ts` |
| SDK list contract | `packages/workspace-sdk/src/tour/tour-list-projection.contract.ts` |
| Ledger DEC-CW-02 | `docs/dev/composable-workspace-refactor-plan.md` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/decisions/DEC-CW-02-evidence.md`.*
