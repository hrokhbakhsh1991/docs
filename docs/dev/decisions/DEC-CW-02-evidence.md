# DEC-CW-02 — Archive: generic lifecycle state vs workspace/vertical capability

**Decision id:** DEC-CW-02  
**Status:** PROPOSAL (evidence packet — no product decision recorded)  
**Prepared by:** Worker D (CW Wave 3A decision-evidence track)  
**Date:** 2026-08-23  
**Repository ref:** `7d3daac6` (main)  
**Blocks:** CW3-05 archive-row final semantics; CW5-04 archive enumeration; CW9-05 archive assertions  
**Does not block:** CW3-05 placeholder (`archived` → not-published bucket) per ledger

---

## 1. Decision question

Should **archive** become a **generic lifecycle state** in neutral tour-core / SDK lifecycle contracts, or remain a **workspace/vertical capability** (optional product extension with workspace-owned vocabulary)?

---

## 2. Evidence summary

| Finding | Source |
|---------|--------|
| Archive is implemented only in Urban operator list projection and field enum | TRUTH §6; `urban/list/tour-list-projection.ts`; `urban/internal.ts` |
| Denali has no archive path — `draft`/`active` only; non-`active` maps to draft in list projection | `denali/list/tour-list-projection.ts`; `denali-publish-status-field.tsx` |
| Harbor checks `published` only; no `archived` enum or transition | `harbor/catalog/to-harbor-catalog-card.ts` |
| Starter lifecycle is `DRAFT` → `OPEN` only; no archive concept | `starter-plugin-core.ts` (`STARTER_LIFECYCLE`) |
| CW0-02 publish-transition goldens cover draft/active, published, DRAFT/OPEN — **no archive transition cases** | `test/parity/fixtures/publish-transition/workspace-publish-transitions.json` |
| SDK list contract already includes `archived` as a **projection** label, not a lifecycle graph node | `tour-list-projection.contract.ts` |
| Host operator list filter `archived` maps DB `publishStatus` to `closed`/`cancelled`/`archived` — host-level aggregation, not workspace lifecycle graph | `operator-tour-list-db-query.ts` |
| Ledger non-goal #14 forbids making archive generic before this decision | `composable-workspace-refactor-plan.md` |

---

## 3. Current archive behavior by workspace

### 3.1 Denali (outdoor / operator admin)

| Surface | Behavior |
|---------|----------|
| **Canonical vocabulary** | `publishStatus`: `draft` \| `active` only |
| **Wizard UI** | `PUBLISH_STATUS_VALUES = ["draft", "active"]` — no archive option |
| **Publish transition** | `draft` ↔ `active`; emits `published` / `unpublished` transition types |
| **Public catalog visibility** | `isDenaliTourPublished` → `publishStatus === "active"` |
| **Operator list projection** | `active` → `{ listStatus: "open", uiStatus: "active" }`; anything else → draft |
| **Archive path** | **None** — an `archived` string would fall through to draft in list projection |
| **Exposure / reminders** | Denali-specific exposure surfaces (`public_list`, `reminder_feed`); gated on published/active tours via catalog loaders — no archive branch |
| **Tests** | `denali-tour-publish-transition.spec.ts`; CW0-02 denali cases |

### 3.2 Urban (events vertical)

| Surface | Behavior |
|---------|----------|
| **Canonical vocabulary** | `tour.publishStatus`: `draft` \| `published` \| `archived` (field enum); legacy `tour.status`: `draft` \| `published` only |
| **Publish transition detector** | Types limited to `draft` \| `published`; `normalizeUrbanPublishStatus` **drops** `archived` (returns `undefined`) |
| **Public catalog visibility** | `isUrbanTourPublished` → `publishStatus === "published"` only — **archived is not published** |
| **Operator list projection** | `published` → published/active; `archived` → `{ listStatus: "archived", uiStatus: "archived" }`; else draft |
| **Registration gate** | `requireWorkspacePublishedTour` + `isUrbanTourPublished` — archived tours **reject** new registrations |
| **Archive transition rules** | **No dedicated archive transition** in code or CW0-02 goldens; archive is a **static label**, not a lifecycle-graph edge |
| **Tests** | `tour-list-projection.spec.ts` covers published only (no archived case); CW0-02 urban cases omit archive |

### 3.3 Harbor (guest-club / smoke catalog)

| Surface | Behavior |
|---------|----------|
| **Canonical vocabulary** | `publishStatus` or `status`: `draft` \| `published` (smoke fixtures) |
| **Public catalog visibility** | `isHarborTourPublished` → `status === "published"` |
| **Archive path** | **None in implementation** — ledger planning text mentions `published` + `archived` but Harbor code has no `archived` branch |
| **Tests** | `to-harbor-catalog-card.spec.ts`; CW0-02 harbor draft→published cases |

### 3.4 Starter (SDK reference / minimal plugin)

| Surface | Behavior |
|---------|----------|
| **Lifecycle contract** | `initialStatus: "DRAFT"`, `publishStatus: "OPEN"`, `allowedTransitions: [{ from: "DRAFT", to: "OPEN" }]` |
| **Publish transition** | `DRAFT` → `OPEN` allowed; `OPEN` → `DRAFT` disallowed |
| **Archive path** | **None** — plugin lifecycle has no terminal/archive state |
| **Tests** | CW0-02 starter lifecycle + publish-transition cases |

### 3.5 Cross-workspace host behavior

| Surface | Behavior |
|---------|----------|
| **API lifecycle gate** | `assertTourPublishLifecycleOnUpdate` maps labels via `isPublishedPublishStatusLabel` — recognizes `published` and `active` as published; `archived` is **not** published → resolves to `initialStatus` |
| **Operator list status filter** | UI filter `archived` queries DB `publishStatus IN ('closed','cancelled','archived')` — host aggregation across vocabularies |
| **SDK list contract** | `TourListStatus` includes `archived`; `TourUiStatus` includes `archived` — projection output, not lifecycle graph node |

---

## 4. CW0-02 publish-transition parity evidence

**Harness:** `test/parity/publish-transition.golden.spec.mjs`  
**Fixture:** `test/parity/fixtures/publish-transition/workspace-publish-transitions.json`  
**Status:** `[x]` complete (CW-0 exit 2026-08-23)

### 4.1 Covered transitions (frozen)

| Workspace | Cases | Invariant |
|-----------|-------|-----------|
| Denali | `draft→active`, `active→draft`, draft stable, nested `basicInfo` | `detectDenaliTourPublishTransition` |
| Urban | `draft→published`, published stable | `detectUrbanTourPublishTransition` |
| Harbor | flat + nested `tour.status` draft→published | `isHarborTourPublished` delta |
| Starter | `DRAFT→OPEN` allowed, `OPEN→DRAFT` disallowed, publish flag transition | `STARTER_LIFECYCLE` + generic detector |

### 4.2 Archive gap in CW0-02

No golden cases exist for:

- Urban `published` → `archived`
- Urban `archived` → `published` (unarchive)
- Urban `archived` stable (no transition)
- Denali or Harbor archive at all

**Implication:** Archive is **outside** the CW0-02 parity floor. Any generic lifecycle enum that includes `archive` would be **new semantics**, not preserved behavior.

### 4.3 Urban archive vs publish-transition type tension

`urban-tour-publish-transition.ts` declares `UrbanTourPublishStatus = "draft" | "published"` and normalizes away `archived`. An archived tour is treated as **unpublished** for transition detection (`isUrbanTourPublished` is false). List projection separately maps `archived` → archived chip. **Publish transition and list status disagree on archived semantics today.**

---

## 5. Options

### Option A — Generic lifecycle state (platform-wide)

**Shape:** Add `ARCHIVED` (or equivalent) to neutral `tour-core` / SDK lifecycle contract; every workspace manifest declares whether the state is reachable; CW3-05 maps all workspace archive labels to one enum value; CW5-04 formalizes archive in publish orchestration ports.

| Pros | Cons |
|------|------|
| Single enumeration for operator filters, OpenAPI, tour-core transition tables | **Forces Denali product decision** — today no archive path; TRUTH labels Denali gap "incomplete implementation" vs Urban "intentional variation" |
| Symmetric CW9 certification archive assertions | CW0-02 goldens do not cover archive — adoption is **semantic change**, not parity preservation |
| Simpler host `publishStatusesForOperatorFilter` mapping | Violates ledger non-goal #14 if executed before this decision |
| | Urban `archived` is not a publish-transition edge today — generic graph must invent transitions (archive from published? unarchive?) without product sign-off |
| | Harbor has no archive implementation — would need stub or new product scope |

**Risk:** **HIGH** — collapses intentional vertical divergence; blocks on Denali archive product requirement (currently unknown / absent).

### Option B — Workspace/vertical capability (recommended PROPOSAL)

**Shape:** Archive is an **optional capability** (manifest block, e.g. `workspaceTourArchive` or extension of publish/lifecycle policy). Urban binds it; Denali/Starter/Harbor omit it. Neutral core exposes only:

- `isPubliclyVisible` (publish visibility port — CW3)
- `notPublished` bucket for any non-visible terminal label (CW3-05 placeholder)
- Workspace adapter maps `archived` → list projection + operator filter

| Pros | Cons |
|------|------|
| Matches TRUTH §6 **WORKSPACE_SPECIFIC** classification | More manifest/codegen surface (capability block + certification) |
| Denali unchanged until product explicitly requests archive | Operator list filter remains host-aggregated (`closed`/`cancelled`/`archived`) |
| CW3-05 can ship with `archived` → not-published placeholder **without** inventing global enum | CW9-05 different-vertical archive assertions stay workspace-scoped |
| Preserves CW0-02 parity floor (no archive cases required) | Two workspaces with archive could diverge on unarchive rules unless capability contract is tight |
| Aligns with composable-workspace target (capabilities + policy, not Denali-default platform) | |

**Risk:** **LOW–MEDIUM** — additive; defers Denali archive product decision.

### Option C — Hybrid: generic projection label, workspace-owned lifecycle

**Shape:** Keep `TourListStatus.archived` / `TourUiStatus.archived` in SDK projection contract (already exists). Do **not** add `ARCHIVED` to `WorkspaceLifecycleContract` graph. Archive vocabulary and transitions stay workspace field enums + policy modules; tour-core only knows published vs not-published.

| Pros | Cons |
|------|------|
| Minimal change to CW3-05/CW5-04 — projection already has `archived` | Sits between A and B; may confuse "is archived a lifecycle state or a list chip?" |
| No new lifecycle graph edges in neutral core | Still needs manifest declaration for which workspaces emit `archived` projection |
| | Less explicit than Option B capability block for CW-7/CW-9 certification |

**Risk:** **MEDIUM** — workable but less clear ownership than Option B.

---

## 6. Archive semantics impact analysis

### 6.1 Public exposure

| Workspace | Archived tour visible? | Mechanism |
|-----------|------------------------|-----------|
| Denali | N/A (no archive) | — |
| Urban | **No** | `isUrbanTourPublished` excludes `archived` |
| Harbor | N/A | — |
| Starter | N/A | — |

Archived Urban tours behave like **draft** for public/marketing/portal catalog egress.

### 6.2 Catalog listing and cards

- `filterWorkspacePublishedTours` uses workspace `isPublished` predicate — archived Urban tours **excluded** from public catalog pages.
- Catalog card mappers (`toUrbanCatalogCard`, `toHarborCatalogCard`, Denali catalog service) never treat archived as published.
- **No catalog card variant** for archived state on public surfaces.

### 6.3 Registration

- `requireWorkspacePublishedTour` blocks registration when `isPublished` is false.
- Urban archived tours: **registration closed** (same as draft).

### 6.4 Reminders and exposure (Denali-specific)

- Denali exposure/reminder scheduler (`start-denali-exposure-reminder-scheduler.ts`) operates on Denali tours loaded via published/active catalog paths.
- Urban has no equivalent reminder activation path in current code.
- Archive impact on reminders: **none today**; if Denali later adds archive, reminders must stop for archived tours (product rule TBD).

### 6.5 Operator list and filters

- Urban operator UI shows `archived` chip via list projection.
- Web operator filter `archived` uses host DB query mapping to multiple `publishStatus` strings — works for Urban `archived` but also aggregates legacy `closed`/`cancelled` labels not used by current workspaces.
- Denali operator would **not** show archived chip for any current canonical state.

### 6.6 API lifecycle gate

- `assertTourPublishLifecycleOnUpdate`: `archived` label → `initialStatus` (not `publishStatus` / OPEN) because `isPublishedPublishStatusLabel` returns false.
- Transition from `published` to `archived` may **fail lifecycle assertion** depending on workspace `allowedTransitions` — **undefined behavior today** (no test, no manifest edge).

### 6.7 Persistence

- Archive is **canonical JSON only** (TRUTH §6) — `tour.publishStatus = "archived"` stored in tour row; no separate archive table.

---

## 7. Open product questions (for Architect / Tour product owner)

1. **Denali archive requirement:** Is archive needed for outdoor trips (seasonal close-out, legal retention), or is Urban-only archive permanent?
2. **Urban archive transitions:** Allowed edges? `published → archived` only? `archived → published` (unarchive)? `draft → archived`?
3. **Urban archive side effects:** Cancel open registrations? Hide from operator default view? Telegram/catalog webhook on archive?
4. **Harbor:** Should guest-club events support archive, or stay draft/published only?
5. **Restoration / unarchive:** Required for compliance or operator workflow?

---

## 8. Recommended choice (PROPOSAL)

**Recommend Option B — workspace/vertical capability**, with Option C projection labels retained.

### Rationale

1. **Evidence-weighted divergence:** TRUTH §6 and AUDIT classify archive as Urban **intentional product variation**; Denali has **no implementation path**.
2. **Parity floor:** CW0-02 does not snapshot archive — generic lifecycle enum would be new semantics, not refactor preservation.
3. **Existing code tension:** Urban already treats `archived` as unpublished for transitions but archived for list chips — a **workspace policy** problem, not a universal lifecycle node.
4. **Composable architecture fit:** Archive behaves like other vertical extensions (events vertical needs post-publish terminal state; outdoor may not). Capability block keeps tour-core neutral per DEC-CW-07.
5. **Safe CW3-05 path:** Continue `archived` → **not-published placeholder** in manifest label mapping until capability contract is designed; do not add `ARCHIVED` to `WorkspaceLifecycleContract` in CW5-04.

### Proposed execution guardrails (if approved)

| Task | Guidance |
|------|----------|
| CW3-05 | Map `archived` → not-published bucket; document Urban-only source label |
| CW3-07 | Urban list projection keeps `archived` chip; Denali unchanged |
| CW5-04 | Publish orchestration ports expose `isPubliclyVisible` + workspace label mapping; **no** global `ARCHIVED` enum |
| CW9-05 | Archive assertions scoped to workspaces declaring archive capability |
| Future CW-7-style module | Optional `workspaceTourArchive` with transition policy + certification |

### Reject Option A unless

- Product owner signs Denali archive requirement **and** Urban transition matrix **and** accepts CW0-02 golden expansion for archive edges.

---

## 9. Evidence file index

| Artifact | Path |
|----------|------|
| TRUTH archive section | `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` §6 |
| CW0-02 aggregate fixture | `test/parity/fixtures/publish-transition/workspace-publish-transitions.json` |
| CW0-02 parity spec | `test/parity/publish-transition.golden.spec.mjs` |
| Urban list projection | `packages/workspaces/urban/src/list/tour-list-projection.ts` |
| Urban publish visibility | `packages/workspaces/urban/src/http/publish-status.ts` |
| Urban publish transition | `packages/workspaces/urban/src/tours/urban-tour-publish-transition.ts` |
| Denali list projection | `packages/workspaces/denali/src/list/tour-list-projection.ts` |
| Denali publish visibility | `packages/workspaces/denali/src/catalog/denali-publish-status.ts` |
| Harbor publish visibility | `packages/workspaces/harbor/src/catalog/to-harbor-catalog-card.ts` |
| Starter lifecycle | `packages/workspace-sdk/src/reference/starter-plugin-core.ts` |
| API lifecycle gate | `apps/api/src/canonical/assert-tour-publish-lifecycle-gate.ts` |
| Operator archived filter | `apps/api/src/tours/operator-tour-list-db-query.ts` |
| SDK list contract | `packages/workspace-sdk/src/tour/tour-list-projection.contract.ts` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/decisions/DEC-CW-02-evidence.md`.*
