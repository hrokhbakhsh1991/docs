# Phase 9.5 — Registration Command Center (Bookings Ops UX)

```yaml
ux_spec_id: BOOKINGS-OPS-UX
version: "2026-08-07-v6"
status: LOCKED
decisions: [DEC-P9-006, DEC-P9-008, DEC-P9-011]
subphase: "9.5"
authority: subphases/9.5-bookings-ops.md · IMPLEMENTATION-DECISIONS.md
pattern: SETTINGS-MODULE-REGISTRY.md (manifest-driven workspace plugin)
legacy_reference:
  - legacy/apps/web/app/(app)/leader/review/
  - legacy/apps/web/app/(app)/bookings/
research:
  - https://www.shadcn.io/blocks/crud-approval-queue
  - https://kanbantool.com/kanban-board-examples
  - https://baymard.com/blog/current-state-accounts-selfservice
  - https://www.igms.com/unified-host-dashboard/
  - https://manual.bookingsync.com/hc/en-us/articles/21397949220253-Unified-Inbox-Manual-Page
  - https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/arrivals_search.htm
remediation_wave: "2026-08-07-ops-path-complete-p4d"
next_wave: "p3b-audit" # optional — true activity stream; not required for ops scope path
```

> **Problem:** Legacy splits operator approval (`leader/review` — rich multi-tour queue) from participant bookings list (`bookings/` — own registrations). Phase 9 needs one **Denali-native** surface that scales to many concurrent tours, stays swappable per workspace, and preserves approve/reject + outbox semantics (TQ-P9-006).

---

## 1. Design north star

| Principle                 | Implementation                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **One Command Center**    | `(app)/bookings` = Registration Ops Inbox for admin/owner                          |
| **Multi-tour first**      | Tour chips, swimlanes, departure timeline — not single-tour assumptions            |
| **Split-pane decisions**  | Queue + sticky inspection panel (legacy leader/review pattern, upgraded)           |
| **Manifest-driven UI**    | `RegistrationOpsManifest` in Denali plugin — Urban can ship simpler manifest later |
| **Role-aware same route** | Member on `/bookings` → **mine** view only; admin → **ops** view                   |
| **No duplicate logic**    | `(app)/leader/review` reuses shell — alias, not second implementation              |

---

## 2. Information architecture

```text
(app)/bookings                    ← Registration Command Center (ops | mine by CASL)
(app)/bookings/new                ← Manual create (admin/owner)
(app)/bookings/[id]               ← Deep link → `/bookings?bookingId={id}` (inspection panel focus)
(app)/leader/review               ← Alias → /bookings?view=inbox_table&scope=leader (DEC-P9-011)
(app)/tours/[id]/workspace/...    ← Registrations tab embeds same component with tourId preset
```

### View modes (operator toggles — persisted `localStorage` + optional tenant default)

| View ID              | Label (shipped chrome) | Best for                                |
| -------------------- | ---------------------- | --------------------------------------- |
| `inbox_table`        | Inbox                  | Daily ops — sortable list, bulk select  |
| `tour_board`         | **By tour**            | Group loaded rows by `tourId` (thin layout) |
| `departure_timeline` | By departure           | Urgency — group by UTC departure day    |

> **UX-BKG-44 (2026-08-07):** Shipped Command Center uses URL `layout=inbox|timeline|board` (wire token `board` = **By Tour**). Operator copy must not say “Board” or promise Kanban. Early “Kanban columns × tour swimlanes” for `tour_board` is **aspirational / superseded** — DnD status Kanban remains a non-goal until a separate epic.

**MVP (9.5-R2):** `inbox_table` required for closure.  
**9.5-R4 (pre-9.8 optional):** thin `tour_board` + `departure_timeline` (grouping only — see UX-BKG-39).

---

## 3. Layout wireframe

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ KPI strip: Pending (12) · Approved today (4) · Departures 7d (3) · Waitlist (5) │
├─────────────────────────────────────────────────────────────────────────┤
│ [Search guest/email/phone]  [Tour chips ▼]  [Status ▼]  [Dates ▼]  Inbox|By departure|By tour │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Queue (60%)                  │ Inspection panel (40%)                   │
│ ┌──────────────────────────┐ │ Guest · party size · capacity bar 7/12   │
│ │ □ Ali · North Tour · 2p  │ │ Tour title · departure · meeting point   │
│ │ □ Sara · Desert · 1p ⚠  │ │ Payment · transport · notes              │
│ │ ...                      │ │ Status history (audit read-only)         │
│ └──────────────────────────┘ │ [ Reject ] [ Waitlist ] [ Approve ✓ ]    │
└──────────────────────────────┴──────────────────────────────────────────┘
```

Mobile: queue full-width → tap row → bottom **Sheet** with sticky approve/reject footer.

---

## 4. Row / card field model

| Field                       | Source                          | Why                                          |
| --------------------------- | ------------------------------- | -------------------------------------------- |
| `guestLabel`                | registration contact            | Scan queue                                   |
| `partySize`                 | registration                    | Capacity decision                            |
| `capacitySnapshot`          | tour + approved count           | Inline `7/12` bar — no detail click required |
| `tourTitle` + `departureAt` | tour join                       | Multi-tour sort by urgency                   |
| `paymentStatus`             | registration/finance projection | Auto-accept vs manual path                   |
| `transportMode`             | registration CRM                | Legacy parity                                |
| `status`                    | registration                    | Badge + pipeline column                      |
| `submittedAt`               | registration                    | SLA hint («3 days pending»)                  |
| `priority`                  | manifest rule (optional)        | VIP / departure < 48h                        |

---

## 5. RegistrationOpsManifest (DEC-P9-011)

**SDK types:** `packages/workspace-sdk/src/operator/bookings/registration-ops-manifest.ts`  
**Denali manifest:** `packages/workspaces/denali/src/bookings/ops-manifest.ts`  
**Web consumer:** `apps/web/src/features/bookings/` — no direct `@app-tour/workspace-denali` import in routes (TQ-P9-002).

```typescript
export type RegistrationOpsViewId = "inbox_table" | "tour_board" | "departure_timeline";

export type RegistrationOpsManifest = {
  id: string;
  defaultView: RegistrationOpsViewId;
  views: RegistrationOpsViewId[];
  statusPipeline: readonly string[]; // pending → approved → waitlisted → rejected → cancelled
  kpiCards: readonly ("pending" | "approved_today" | "departures_7d" | "waitlist")[];
  filters: readonly ("tourId" | "status" | "departureRange" | "paymentStatus" | "search")[];
  columns: {
    inbox_table: readonly string[];
    tour_board: { groupBy: "tourId"; columns: readonly string[] };
  };
  actions: {
    approve: { ability: "operator.bookings.approve"; outboxEvent: string };
    reject: { ability: "operator.bookings.approve"; requiresReason?: boolean };
    promoteWaitlist: { ability: "operator.bookings.approve" };
    bulkApprove: { ability: "operator.bookings.approve"; maxBatch: number };
  };
  leaderReviewAlias: {
    enabled: true;
    path: "/leader/review";
    query: "view=inbox_table&scope=leader";
  };
};
```

### Denali default manifest (locked for 9.5)

```typescript
export const denaliRegistrationOpsManifest = {
  id: "denali_registration_ops",
  defaultView: "inbox_table",
  views: ["inbox_table", "tour_board", "departure_timeline"],
  statusPipeline: ["pending", "approved", "waitlisted", "rejected", "cancelled"],
  kpiCards: ["pending", "approved_today", "departures_7d", "waitlist"],
  filters: ["tourId", "status", "departureRange", "paymentStatus", "search"],
  columns: {
    inbox_table: [
      "guest",
      "tour",
      "departure",
      "party",
      "capacity",
      "payment",
      "status",
      "actions",
    ],
    tour_board: {
      groupBy: "tourId",
      // Historical aspirational columns — shipped UI ignores columns (By Tour sections only; UX-BKG-44).
      columns: ["pending", "approved", "waitlist", "rejected"],
    },
  },
  actions: {
    approve: { ability: "operator.bookings.approve", outboxEvent: "registration.approved" },
    reject: { ability: "operator.bookings.approve", requiresReason: false },
    promoteWaitlist: { ability: "operator.bookings.approve" },
    bulkApprove: { ability: "operator.bookings.approve", maxBatch: 25 },
  },
  leaderReviewAlias: {
    enabled: true,
    path: "/leader/review",
    query: "view=inbox_table&scope=leader",
  },
} satisfies RegistrationOpsManifest;
```

**Urban (future):** manifest with `views: ["inbox_table"]` only — same shell, fewer toggles.

### 5.1 Trunk implementation (S9.5-R0)

| Artifact                                      | Path                                                                        | Proof                           |
| --------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| SDK types + `validateRegistrationOpsManifest` | `packages/workspace-sdk/src/operator/bookings/registration-ops-manifest.ts` | SDK-9.5-01                      |
| Denali default manifest                       | `packages/workspaces/denali/src/bookings/ops-manifest.ts`                   | DN-9.5-01                       |
| Plugin wiring                                 | `WorkspacePlugin.registrationOps` on `createDenaliWorkspacePlugin()`        | `bookings-ops-manifest.spec.ts` |

Validation rejects any `views[]` entry outside `inbox_table` \| `tour_board` \| `departure_timeline` before plugin registration maps are built.

### 5.2 Trunk implementation (S9.5-R1 — API velocity slice)

| Artifact | Path | Proof |
| -------- | ---- | ----- |
| Booking row + query types | `apps/api/src/bookings/bookings.types.ts` | `bookings-ops.spec.ts` |
| In-memory store + atomic outbox | `apps/api/src/bookings/in-memory-bookings.repository.ts` | API-9.5-01 |
| Service (list/summary/create/approve/reject) | `apps/api/src/bookings/bookings.service.ts` | API-9.5-02 · API-9.5-03 |
| HTTP handlers | `apps/api/src/bookings/bookings.routes.ts` | dispatch addendum v2 |
| App dispatch wiring | `apps/api/src/app.ts` | manual route table |
| Dev/test seed | `apps/api/test/fixtures/operator-bookings-fixture.ts` | `OPERATOR_SMOKE.pendingBookingId` |
| Smoke dev auto-seed | `in-memory-bookings.repository.ts` `seedOperatorSmokeDevBookingsFixture` | `NODE_ENV=test\|development` mirrors fixture · **SMK-P9-04** |
| Smoke tour seed | `in-memory-tour.repository.ts` `ensureOperatorSmokeSeedTour` + `OPERATOR_SMOKE_E2E_SEED=1` | `OPERATOR_SMOKE.seedTourId` · **SMK-P9-07** manual create |

**Fail-closed rules (R1):**

| Rule | Enforcement |
| ---- | ----------- |
| P9-F-006 | `approveBooking` updates `status=approved` and inserts `registration.approved` outbox row in one repository transaction — partial writes roll back |
| CP-9.5-04 | `view=ops` with `role=member` → **403** `BOOKINGS_OPS_FORBIDDEN` |
| CP-9.5-06 | `POST /bookings` (admin/owner) → **201** with `status=pending` |
| Summary ACL | `GET /bookings/summary` admin/owner only — member **403** |

**In-memory row shape (R1):**

```typescript
type BookingRecord = {
  id: string;
  tenantId: string;
  tourId: string;
  tourTitle: string;
  guestLabel: string;
  guestEmail: string | null;
  guestPhone: string | null;
  partySize: number;
  status: "pending" | "approved" | "waitlisted" | "rejected" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  // … finance receipt approve → paid; prepayment → partial (see FINANCE-OPS-UX §5.3)
  departureAt: string; // ISO
  submittedAt: string; // ISO
  submittedByUserId: string; // mine-view filter
  approvedAt: string | null;
};
```

**List query (R1):** `view`, `status`, `tourId`, `q`, `cursor`, `limit` — `from`/`to`/`paymentStatus` deferred to R3.

### 5.3 Trunk implementation (S9.5-R2 — Command Center inbox)

| Artifact | Path | Proof |
| -------- | ---- | ----- |
| Feature types + test ids | `apps/web/src/features/bookings/bookings-command-center-types.ts` | WEB-9.5-02 |
| Query + gate helpers | `apps/web/src/features/bookings/bookings-command-center-logic.ts` | WEB-9.5-02 |
| Page shell | `apps/web/app/(app)/bookings/page.tsx` | CP-9.5-01 |
| Client inbox + inspection panel | `apps/web/app/(app)/bookings/bookings-page-client.tsx` | WEB-9.5-02 |
| Member locked panel | `apps/web/app/(app)/bookings/bookings-command-center-gate.ts` | CP-9.5-04 |
| BFF list + summary | `apps/web/app/api/bookings/route.ts` · `summary/route.ts` | BFF parity |
| BFF approve/reject | `apps/web/app/api/bookings/[id]/approve/route.ts` · `reject/route.ts` | SMK-P9-04 |
| Legacy alias | `apps/web/app/(app)/leader/review/page.tsx` → shared shell `view=inbox_table&scope=leader` | WEB-9.5-03 · DEC-P9-011 |

**R2 UX scope:** KPI strip (summary API) · status filter · inbox table with row select · sticky inspection panel with Approve/Reject. Tour chips and bulk select deferred to **S9.5-R3**.

### 5.4 Trunk implementation (S9.5-R3 — tour chips + bulk approve)

| Artifact | Path | Proof |
| -------- | ---- | ----- |
| Summary `tourChips[]` | `apps/api/src/bookings/bookings.service.ts` | API-9.5-05 |
| `paymentStatus` list filter | `apps/api/src/bookings/bookings.routes.ts` | WEB-9.5-04 |
| `POST /bookings/bulk-approve` | `apps/api/src/bookings/bookings.routes.ts` | API-9.5-05 · P9-F-006 |
| Tour chip bar + bulk select UI | `apps/web/app/(app)/bookings/bookings-page-client.tsx` | WEB-9.5-04 |
| Chip/bulk helpers | `apps/web/src/features/bookings/bookings-command-center-logic.ts` | WEB-9.5-04 |
| BFF bulk approve | `apps/web/app/api/bookings/bulk-approve/route.ts` | SMK-P9-04 |

**`tourChips` shape (summary R3):**

```typescript
type BookingTourChip = {
  tourId: string;
  tourTitle: string;
  pendingCount: number;
  totalCount: number;
};
```

Chips derive from tenant booking rows (not a second tours query). Clicking a chip sets `tourId` URL param; **All tours** clears it.

**Bulk approve (R3):** inbox rows with `status=pending|waitlisted` expose checkboxes; **Approve selected** calls `POST /bookings/bulk-approve` with `ids[]` capped at manifest `maxBatch` (25). Each id writes its own outbox row inside one repository transaction.

**List filters added in R3:** `paymentStatus=unpaid|partial|paid` (query param).

**Finance sync:** Approving a manual payment receipt in Finance Command Center must update this booking field to `paid` so the inspection panel / filters reflect settlement (see FINANCE-OPS-UX §5.3).

### 5.5 Trunk implementation (S9.5-R5 — manual create UI)

| Artifact | Path | Proof |
| -------- | ---- | ----- |
| Form types + test ids | `apps/web/src/features/bookings/bookings-create-types.ts` | WEB-9.5-05 |
| Validation + payload builder | `apps/web/src/features/bookings/bookings-create-logic.ts` | WEB-9.5-05 |
| Create page | `apps/web/app/(app)/bookings/new/page.tsx` | SMK-P9-07 |
| Client form | `apps/web/app/(app)/bookings/new/bookings-create-page-client.tsx` | CP-9.5-06 |
| Member gate | `apps/web/app/(app)/bookings/new/bookings-create-gate.ts` | CP-9.5-04 |
| Command Center CTA | `bookings-page-client.tsx` → link `/bookings/new` | SMK-P9-07 |

**Form fields (R5 MVP):** tour select (from `GET /api/tours`) · guest name · party size · departure date · optional email/phone. Submit → `POST /api/bookings` (BFF) → redirect `/bookings?status=pending` on **201**.

**ACL:** admin/owner only — member sees locked panel (same pattern as users directory).

**Leader alias (R5):** already on trunk via `(app)/leader/review` redirect — no second implementation.

---

## 6. API contract (consumer of dispatch addendum v2)

| Operation                     | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `GET /bookings`               | Queue with `tourId`, `status`, `from`, `to`, `q`, `view=ops\|mine` |
| `GET /bookings/summary`       | KPI strip counts (pending, today, departures, waitlist)            |
| `GET /bookings/{id}`          | Inspection panel payload + audit tail                              |
| `POST /bookings/{id}/approve` | Transactional status + outbox                                      |
| `POST /bookings/{id}/reject`  | Transactional status + optional reason body                        |
| `POST /bookings/bulk-approve` | Batch ≤ manifest `maxBatch`                                        |
| `POST /bookings`              | Manual create (201 pending)                                        |

**Fail-closed:** approve/bulk-approve without outbox row → **FAIL** P9-F-006.

---

## 7. CASL / role matrix

| Actor                  | `/bookings` view                 | Approve/reject         | `/leader/review`                                   |
| ---------------------- | -------------------------------- | ---------------------- | -------------------------------------------------- |
| Admin/Owner            | `ops` — all tenant registrations | **allow**              | **allow** (legacy URL alias)                       |
| Admin (tour ACL scope) | `ops` filtered by assigned tours | **allow** per tour ACL | **allow** (legacy DB `leader` hydrates to `admin`) |
| Member                 | `mine` — own registrations only  | **deny** 403           | **deny** 403                                       |

Surface: `operator.bookings.approve` · `operator.bookings.read` — see [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md).

---

## 8. Implementation roadmap (doc-only slices)

| Slice       | Deliverable                                       | Proof                             |
| ----------- | ------------------------------------------------- | --------------------------------- |
| **S9.5-R0** | This doc + DEC-P9-011 + SDK types                 | `phase-9:guard`                   |
| **S9.5-R1** | API list/summary/approve/reject + filters         | `bookings-ops.spec.ts`            |
| **S9.5-R2** | Inbox table + inspection panel                    | `bookings-command-center.spec.ts` |
| **S9.5-R3** | Tour chips + KPI strip                            | CP-9.5-08                         |
| **S9.5-R4** | Tour board view                                   | CP-9.5-09 (optional pre-9.8)      |
| **S9.5-R5** | Legacy `/leader/review` URL alias + manual create | SMK-P9-06 · SMK-P9-07             |

---

## 9. Anti-patterns (FAIL)

| Pattern                                         | Detection                                              |
| ----------------------------------------------- | ------------------------------------------------------ |
| Second approve UI only in `leader/review`       | Duplicate handlers — use shared `features/bookings`    |
| Hardcoded tour columns not in manifest          | `phase-9.contract.spec.ts`                             |
| Member sees full tenant queue                   | CASL + `view=mine` API filter                          |
| Approve without capacity check when tour capped | CP-9.5-10 optional warn (UI) — API enforces hard limit |

---

## 10. Cross-references

| Doc                                                                      | Role                        |
| ------------------------------------------------------------------------ | --------------------------- |
| [`bookings-api-dispatch-addendum.md`](bookings-api-dispatch-addendum.md) | HTTP dispatch v2            |
| [`TRACEABILITY-MATRIX-9.5.md`](TRACEABILITY-MATRIX-9.5.md)               | REQ ↔ spec rollup           |
| [`subphases/9.5-bookings-ops.md`](../subphases/9.5-bookings-ops.md)      | Subphase closure            |
| [`subphases/9.3-tours-operator.md`](../subphases/9.3-tours-operator.md)  | Workspace registrations tab |

---

## 11. Ops inbox UX remediation (2026-08-07)

Forensic pass on live Denali admin `/bookings` (56 rows, API `limit` default 50 + `nextCursor`) found the Command Center behaving like an unbounded report instead of an approval queue. **Wave P0** closes the highest-friction gaps in `apps/web` only (list API already supports keyset pagination; BFF forwards `cursor`/`limit`).

### 11.1 Problems closed in Wave P0

| ID | Defect | Remediation |
| -- | ------ | ----------- |
| UX-BKG-01 | UI ignored `nextCursor`; inbox title used `total` while rendering one page | Keyset **Load more** append; title = loaded vs total (`inboxLoaded`) |
| UX-BKG-02 | Approve/reject/`setError` flipped `bodyState` to `error` and **unmounted** inbox + inspection | Split **list fetch error** (blocks body) vs **action error** (inline banner; queue stays mounted) |
| UX-BKG-03 | Inspection + actions below fold; page-level scroll of ~4kpx list | Desktop: `lg:sticky` inspection with internal scroll; **Approve/Reject above** finance strip; mobile: fixed bottom action bar |
| UX-BKG-04 | Row select did not write `bookingId` to URL (deep link / refresh / share broken) | `router.replace` merges `bookingId` into query; filter changes still omit it via existing serialize |
| UX-BKG-05 | Filter refetch set `loading=true` and replaced ready body with skeleton | Skeleton only when `listData === null`; in-place refresh keeps prior rows |
| UX-BKG-06 | Stale `selectedId` after filter → empty inspection | `findSelectedBooking` falls back to first visible row |

### 11.2 Pagination contract (consumer)

```text
GET /bookings?view=ops&…&limit=50          → { items, total, nextCursor }
GET /bookings?…&cursor={nextCursor}        → next page (append in UI)
```

Web helpers (`bookings-command-center-logic.ts`):

- `buildBookingsApiQuery(query, { cursor? })` — adds `cursor` when loading more
- `mergeBookingsListPages(current, page, "replace" | "append")` — dedupe by `id`
- `buildBookingsCommandCenterHref(pathname, query, bookingId?)` — URL sync for selection

Default page size remains API default **50** (max 100). UI does not invent offset pagination.

### 11.3 Error state machine

```text
list fetch fail  → bodyState = error   (inbox cannot render)
approve/reject/bulk fail → actionError banner above queue (bodyState stays ready|empty)
list refetch (filter) → keep prior listData until success; no full-page skeleton flash
```

### 11.4 Sticky inspection + mobile actions

```text
lg+: STICKY VIEWPORT SPLIT (UX-BKG-42)
     [data-operator-bookings-split] sticky + height ≈ main viewport
     left inbox + right inspection both always painted
     each pane scrolls internally (overflow-y on card body) — not main
     KPI/filters above scroll away in main; once split sticks, queue never pushes inspection off-screen
     filter/layout/URL replace MUST use scroll: false (no jump to page top)
     action row: immediately under guest identity (before intake / finance / timeline)
     mobile bottom Sheet must NOT open (matchMedia / lg gate) — avoids invisible overlay trap

< lg: inbox full width (page scroll); selecting a row opens bottom Sheet with inspection + actions
     dismiss sheet clears bookingId (returns to queue)
```

> **Supersedes** the P0 fixed bottom action bar — P2 (UX-BKG-19) owns mobile inspection.
> **Supersedes** nested dual `max-h` scrollers from UX-BKG-03 that fought layout switches.
> **Supersedes** “inspection-only sticky while main owns the list” (failed in shell: sticky + overflow on the same node + short sticky travel → panel left the viewport). UX-BKG-42 locks the **whole split** to the viewport.

**UX-BKG-40 (2026-08-07):** Changing preset/layout/filter must not reset window/`main` scroll (`scroll: false`). Row cards stay full-width open chrome (see UX-BKG-41).

**UX-BKG-41 (2026-08-07):** `BookingInboxRow` geometry is **layout-invariant**. `layout=inbox|timeline|board` only changes **grouping headers** (day / tour), never column width of rows. **By Tour** (`layout=board`) is stacked full-width tour sections — **not** a multi-column Kanban grid that halves row cards (that looked like cards “resizing” on layout switch).

**UX-BKG-42 (2026-08-07):** Desktop Command Center uses a **sticky viewport-height split**: inbox | inspection stay on screen together; each column scrolls inside its card body. Do **not** rely on inspection-only `position: sticky` inside a tall main-scrolled list (panel exits the viewport).
### 11.5 Wave P1 — ops queue focus (2026-08-07)

Closes remaining high-friction Command Center gaps after P0. Touches `apps/web` plus additive list DTO fields in `packages/booking-http-contracts` + `apps/api` `toListItem` (doc-first).

| ID | Defect | Remediation |
| -- | ------ | ----------- |
| UX-BKG-07 | Default filter `all` pollutes ops queue with rejected/cancelled | **Default = L1 actionable** (`pending`∪`waitlisted`). Bare `/bookings` ⇒ work queue; explicit `status=pending` / `status=waitlisted` keep KPI slices; `status=all` restores full inbox. Serialize omits `status` when default. Wire: `status=pending,waitlisted` on list API (UX-BKG-43a). |
| UX-BKG-08 | KPI strip non-actionable | Clickable KPI → pending → `status=pending`; waitlist → `status=waitlisted`; **approved today → `status=approved` + `approvedWithinDays=1`** (list `approvedAt` UTC-day window matches summary count). Status chip `approved` alone = all-time approved. Departures 7d → L2 via `applyDepartureWindow` (`days=7`, `membership=portfolio` ⇒ `status=all` + `departureWithinDays=7`; **layout preserved**). |

**UX-BKG-43b (2026-08-07):** `GET /bookings?approvedWithinDays=1..30` expands server-side to `approvedAt ∈ [UTC dayEnd−N·24h, UTC dayEnd)` where `dayEnd` is tomorrow UTC midnight relative to clock (N=1 ≡ summary `approvedToday`).| UX-BKG-09 | No clear-filters control | `clearBookingsCommandCenterFilters` + **Clear filters** when any non-default status/payment/tour/search is active |
| UX-BKG-10 | Lifecycle UI only approve/reject | Inspection actions: **Waitlist** (`pending` only), **Cancel** (`pending` \| `waitlisted` \| `approved`). BFF `POST /api/bookings/:id/waitlist` + `/cancel` mirror API. |
| UX-BKG-11 | Bulk silent truncate / ignored `skippedIds` | Select all (page, capped at `maxBatch=25`) + Clear selection; parse `BulkApproveBookingsResponse`; banner when `skippedIds.length > 0` |
| UX-BKG-12 | Contact fields stripped from list DTO | Additive optional `guestPhone` / `guestEmail` on `BookingListItem` via `toListItem`; inspection shows when present |

**Default-status migration note:** Bare `/bookings` is the **L1 work queue** (`pending`∪`waitlisted`). Explicit `status=pending` or `status=waitlisted` keep single-status KPI slices. Use `?status=all` for full history. Cross-status deep links **must** include `status=all` (see `buildBookingsDetailDeepLinkHref` / `/bookings/[id]` redirect); a lone `bookingId` keeps the work-queue default and may not surface approved/rejected/cancelled rows.

**UX-BKG-43a (2026-08-07):** Work Queue = pending+waitlisted. List API accepts `status=pending,waitlisted` (comma `IN` filter, keyset-safe). URL omits `status` when default actionable; Pending/Waitlist KPIs still set a single status.

**UX-BKG-43c (2026-08-07) — Unified L2 departure window:**

One mental model: L2 = orthogonal `departureWithinDays` overlay (not a status, not a layout).

```text
applyDepartureWindow(query, { days, membership?, sortHint? })
  days: null | 1..30     — clears or sets departureWithinDays; enabling clears approvedWithinDays
  membership: preserve (default) | portfolio (status=all) — KPI only
  sortHint: preserve (default) | departureAt — preset Upcoming may set departureAt sort
  NEVER mutates layout
```

| Writer | Intent |
| ------ | ------ |
| Facet Upcoming 7d | toggle `days=7\|null`, preserve membership + sort |
| KPI Departures 7d | `days=7`, `membership=portfolio` (matches summary count) |
| Preset Upcoming | `days=7`, preserve membership, `sortHint=departureAt`, clear search/payment |
| Work Queue / History / status KPIs | `days=null` (or clear window in patch) |

API contract unchanged: `[now, now+N)`. Cursor reset stays at URL replace (filter change). Layout switch remains independent of L2.

**Action matrix (P1):**

```text
pending:     [Reject] [Waitlist] [Approve]  + Cancel
waitlisted:  [Reject] [Approve]             + Cancel
approved:    Cancel only
rejected/cancelled: read-only
```

### 11.6 Wave P2 — scan, a11y, departures filter (2026-08-07)

| ID | Defect | Remediation |
| -- | ------ | ----------- |
| UX-BKG-13 | No copyable registration id for support | Inspection shows truncated id + **Copy** (`navigator.clipboard`) |
| UX-BKG-14 | Rows hide `submittedAt` (SLA opaque) | Row secondary line includes submitted datetime; `formatBookingDateTime` |
| UX-BKG-15 | Inbox not keyboard/AT friendly | `role="listbox"` + row `role="option"` + `aria-selected` |
| UX-BKG-16 | Fake “activity” timeline looked like audit | Relabeled as **status snapshot**; datetime for submit; optional `approvedAt` + `rejectReason` when present |
| UX-BKG-17 | Departures 7d KPI read-only | API `departureWithinDays=1..30` (KPI uses `7`); list + count share same filter window `[now, now+N days)` |
| UX-BKG-18 | No sort control | URL `sort=submittedAt\|departureAt` — **P3b-a:** server keyset (see §11.11). Pre-P3b-a was display-only of loaded pages. |
| UX-BKG-19 | Mobile inspection buried under list | `<lg`: inspection moves to bottom **Sheet**; desktop split pane unchanged |

**`departureWithinDays` contract:**

```text
GET /bookings?view=ops&departureWithinDays=7
→ filters departureAt ∈ [clock.now(), clock.now()+7d)
→ total/count use the same window
```

Wire: `BookingsListQuery.departureWithinDays` → service expands to `departureFrom`/`departureTo` ISO on `BookingListPageInput` → Prisma `departureAt` range + in-memory `matchesBookingListFilters`.

**Display sort (superseded by §11.11 P3b-a):** Historically `sort=departureAt` reordered already-fetched pages only. Server now accepts `sort` and dual keyset.

**Mobile sheet:** Selecting a row opens sheet; dismiss clears `bookingId` from the URL (returns to queue). Primary actions live in the sheet (fixed bottom bar removed when sheet owns the selection).

### 11.7 Wave P3a — capacity, reject reason, ops polish (2026-08-07)

Ships the high-value leftovers from §11.7 without inventing audit GET or dual keyset pagination.

| ID | Defect | Remediation |
| -- | ------ | ----------- |
| UX-BKG-20 | Wireframe `capacitySnapshot` missing on rows | Additive optional `capacitySnapshot?: { occupied: number; max: number \| null }` on `BookingListItem`. `listBookings` after page: `sumApprovedPartySizeByTourIds(unique tourIds)` + **`resolveTourCapacityMaxMany`** (tour SoT `capacityMax` via `getByIds`, **not** stale intake alone). UI: compact `occupied/max` bar on row + inspection. |
| UX-BKG-21 | Reject fires with empty body; no confirm | Dialog before reject; optional reason → `POST …/reject` body `{ reason }` when trimmed non-empty (existing `parseRejectBookingBody`). Empty reason still allowed (`requiresReason: false` for Denali). |
| UX-BKG-22 | Bulk approve no confirm | Confirm dialog with selected count before `bulk-approve`. |
| UX-BKG-23 | Empty copy always “filtered” | Body state distinguishes **empty** (default filters) vs **emptyFiltered** (non-default status/payment/tour/search/departure). |
| UX-BKG-24 | Listbox without arrow keys | Inbox `onKeyDown`: ArrowUp/Down moves selection; Enter activates current. |
| UX-BKG-25 | Tour chips hide volume | Chip label shows `pending/total` from summary. |
| UX-BKG-26 | Finance strip refetches on every row change | Shared client TTL+LRU cache (~45s, max 40 keys) for payments **and** invoice lookup keyed by `registrationId`. |
| UX-BKG-27 | Mobile filter chrome overcrowded | `<sm`: status / payment / sort collapse behind a **Filters** toggle; **single** filter-controls mount (`hidden sm:contents` on desktop). Search + tour chips stay visible. |

**`capacitySnapshot` contract:**

```text
GET /bookings?view=ops&…
→ items[].capacitySnapshot?: { occupied: number; max: number | null }

occupied = Σ partySize where status=approved for that tourId (tenant-scoped)
max      = tour.canonical.capacityMax via BookingTourCapacityPort (null if missing)
```

Same tourId across the page shares one occupied/max pair. Enrichment is list-response only (no extra HTTP round-trip from the browser).

**Capacity batch (debt closure):** `listBookings` calls `BookingTourCapacityPort.resolveTourCapacityMaxMany(tenantId, uniqueTourIds)` once per page. Host adapter loads tours via `TourStorageRepository.getByIds` (single tenant-scoped `findMany`), not N× `getById`.

**UI debt closure:** Command Center filter chrome mounts **once** (mobile toggle + `hidden sm:contents`); reject/bulk dialogs, capacity bar, inspection panel, inbox row, KPI card, and action buttons live under `apps/web/src/features/bookings/` — page client is orchestration only. Finance strip **payments + invoice** share a TTL + max-entry LRU cache keyed by `registrationId` (see `finance-registration-fetch-cache.ts`).

**Reject body (unchanged wire, new UI):**

```text
POST /bookings/{id}/reject
Content-Type: application/json
{}                         → reject without reason
{ "reason": "full tour" }  → persist rejectReason when trim non-empty
```

Timeline remains a **status snapshot** (UX-BKG-16). Showing `rejectReason` after reject does not imply an audit event stream.

### 11.8 Deferred infrastructure

| Item | Status | Notes |
| ---- | ------ | ----- |
| True audit event stream | **Deferred (P3b-audit)** | No `GET /bookings/{id}/activity`; outbox list-by-aggregate removed; reject has no outbox row. Needs read model + HTTP. |
| Server-side departure keyset | **Shipped P3b-a (2026-08-07)** | See §11.11 — dual keyset `(submittedAt DESC,id)` \| `(departureAt ASC,id)`; cursor remains opaque booking id (server reloads row); sort modes must not be mixed mid-page (client resets list on sort change via query refetch). |

### 11.11 P3b-a — Server departure sort keyset (**shipped**)

**Problem:** `sort=departureAt` was display-only on already-fetched pages; Load more kept `(submittedAt DESC)` pages then reordered → wrong global set.

**Contract:**

```text
GET /bookings?view=ops&sort=submittedAt|departureAt
default sort = submittedAt

sort=submittedAt → orderBy submittedAt DESC, id DESC
                 → keyset: (submittedAt, id) strictly older
sort=departureAt → orderBy departureAt ASC, id ASC   (soonest first)
                 → keyset: (departureAt, id) strictly later
```

| Surface | Change |
| ------- | ------ |
| contracts | `BookingsListQuery.sort?`; `parseBookingsListQuery` |
| `BookingListPageInput.sort` | `submittedAt` \| `departureAt` |
| `booking-list-query.ts` | departure ASC compare + keyset predicate (shared) |
| Prisma + in-memory | branch orderBy + keyset; cursor select includes `departureAt` |
| Index | `idx_operator_registrations_tenant_departure_id` on `(tenant_id, departure_at, id)` |
| web | `buildBookingsApiQuery` sends `sort`; doc no longer claims display-only |

**Prefetch debt (P4c follow-up):** `fetchBookingsServerPrefetch` forwards `tourChipScope` from list URL when present.

**Still deferred:** audit GET only (**P3b-audit**). P4d shipped in §11.12.

### 11.12 P4d — Ops path closure (**shipped** 2026-08-07)

Closes the scope-hygiene + layout path without inventing persistence or drag-kanban debt.

| ID | Change | Surfaces |
| -- | ------ | -------- |
| UX-BKG-38 | **URL presets** (not localStorage): `workQueue` · `upcoming` · `history` map to L1/L2/L3 filter bundles via `applyBookingsOpsPreset`. **Upcoming** = `applyDepartureWindow(days=7, sortHint=departureAt, membership=preserve)` + clear search/payment — **does not change `layout`**. Active upcoming = `departureWithinDays=7` + empty search (not gated on sort). Role default remains `ops` vs `mine`; leader alias keeps `scope=leader`. | web chrome |
| UX-BKG-39 | **Thin layouts** via URL `layout=inbox\|timeline\|board` (manifest view names without second approve tree). `timeline` = **By departure** (group by UTC departure day; sets `sort=departureAt`). `board` = **By Tour** (group by `tourId` as stacked full-width sections — UX-BKG-41). Same list API + inspection. **Not** drag-Kanban / virtualized calendar (explicit non-goal; UX-BKG-44). | web only |
| UX-BKG-44 | **Naming lock:** Operator-facing labels = Inbox · By departure · By tour (`bookings.layout.*`). Wire/URL enum value remains `board` (stable deep links). Docs/code comments must not describe shipped `board` as Kanban. | docs + i18n + types |
| UX-BKG-46 | **Manifest chrome Phase 1 (actions only):** `/bookings` resolves `bookingOps.resolveManifest` → `resolveBookingsOpsActionChrome`. Wires `actions.bulkApprove.maxBatch` + `actions.reject.requiresReason`. Null manifest → Denali-shaped defaults (`maxBatch=25`, reason optional). No KPI/filter/layout migration. | page + dialogs |

**Path complete means:** P4a→P4d + P3b-a green. **Out of path:** P3b-audit activity stream; Approve-then-Pay 2–5.

**Verify:** `WEB-9.5-14` preset/layout/group helpers.

### 11.9 Proof

| Check | Location |
| ----- | -------- |
| Query/cursor/merge/href helpers | `apps/web/test/bookings-command-center.spec.ts` |
| P1 helpers | `WEB-9.5-07` |
| P2 sort / departureWithinDays / datetime | `WEB-9.5-08` |
| P3a capacity label / reject body / empty vs filtered | `WEB-9.5-09` |
| P4a tour chip ops predicate / partition | `booking-tour-chips.spec.ts` · `WEB-9.5-10` |
| P4b overdue / upcoming facet / emptyUpcoming | `WEB-9.5-11` |
| Urgency Soon + Aging (UX-BKG-47) | `WEB-9.5-11` helpers |
| Inline Approve only (UX-BKG-48) | `WEB-9.5-07` `shouldShowInlineApprove` |
| Queue visibility soft refresh (UX-BKG-49) | `WEB-9.5-07` `shouldRunBookingsQueueSoftRefresh` |
| Transport inspection-only (UX-BKG-50 amend) | List omits `registrationIntake`; `GET /bookings/{id}` detail + inspection intake panel |
| Departure window mental model (UX-BKG-51) | i18n + aria + optional “Window: Nd” hint — query writers unchanged |
| Lifecycle action safety (UX-BKG-52) | Cancel confirm dialog · inline Approve arm→confirm · inspection Approve/Waitlist one-click |
| Chrome progressive disclosure (UX-BKG-53) | Primary Queues+window+search+chips · KPI signals · Display/Filters secondary/advanced |
| First-time operator clarity (UX-BKG-54) | Copy/labels/helpers/empty states only — no query or chrome hierarchy change |
| Dense queue list rows (UX-BKG-55) | Compact selectable list (dividers) — not per-row card stack |
| P4c tourChipScope all escape / history hint | `WEB-9.5-12` · summary parser |
| P3b-a departure keyset sort | `booking-list-query` specs · `WEB-9.5-13` |
| P4d presets + layout grouping | `WEB-9.5-14` |
| By Tour naming lock (UX-BKG-44) | `WEB-9.5-14` layout i18n + `layout=board` sort-stable |
| Manifest actions Phase 1 (UX-BKG-46) | `bookings-ops-action-chrome.spec.ts` + bulk maxBatch slice |
| Manual | KPI departures7d filters; mobile sheet; copy id; aria option selected; UX-BKG-40 no scroll-jump; UX-BKG-41 row size stable; UX-BKG-42 sticky viewport split keeps inspection on screen |
| API departure window | `apps/api` list filter + contracts parser |

### 11.10 Scope hygiene roadmap (P4) — phased remediations

**Problem (product):** Tour chips + default list can surface **historical noise** (past tours / old rows) while operators need a **work queue** first. Industry ops (STR host dashboards, PMS arrivals, unified inboxes) default to **actionable work** and a **short upcoming window (7–14d)**, not “future-only forever” and not “all history”.

**North-star layers (do not collapse into one filter):**

```text
L1 Work queue     status ∈ pending|waitlisted   — bare URL / workQueue preset (UX-BKG-43a); keep overdue visible
L2 Upcoming ops   departure ∈ [now, now+N]      — N=7 default (existing KPI)
L3 History        status=all / past window      — explicit only (search / status=all)
```

**Hard rule:** Do **not** make bare `/bookings` = “future only”. That hides stuck approvals with `departureAt < now`. Overdue stays in L1 with a badge; upcoming is a separate facet (L2).

---

#### Phase P4a — Tour chip hygiene (**shipped** 2026-08-07)

| ID | Change | Surfaces |
| -- | ------ | -------- |
| UX-BKG-28 | Summary `tourChips` only include tours with **ops signal**: `pendingCount > 0` **OR** `waitlistedCount > 0` **OR** any registration with `departureAt ≥ now`. Waitlist-only past-departure tours stay visible (aligns L1 actionable). **No** upcoming day-cap on chip membership. Historical tours with zero pending/waitlisted and all departures past → **omit**. Shared pure helper: `apps/api/src/bookings/booking-tour-chips.ts` (Prisma + in-memory — no duplicated predicate). Public DTO unchanged (`pendingCount` remains pending-only for chip label). | API summary |
| UX-BKG-29 | UI: max **7** visible chips; overflow → native `<select>` **More tours…** (same `tourId` URL). Truncate title 28 chars + `title` tooltip; pin active chip into visible set; if URL `tourId` missing from summary (legacy deep link), synthesize chip from list row title. Extract `BookingsTourChipBar` — page client stays orchestration-only. | `apps/web` |
| UX-BKG-30 | Proofs: `booking-tour-chips.spec.ts` + `WEB-9.5-10` partition/truncate/ensure-active. | tests |

**Finance note:** Finance tour filter consumes the same summary → inherits ops-scoped chips in P4a (noise down). Escape hatch `tourChipScope=all` is **P4c**, not duplicated here.

**Out of P4a:** default list date cut; P3b keyset; overdue badge (P4b).

**Verify:** targeted API + web unit specs — no full gate.

---

#### Phase P4b — Work-queue urgency (**shipped** 2026-08-07)

| ID | Change | Surfaces |
| -- | ------ | -------- |
| UX-BKG-31 | Row + inspection: **Overdue** badge when `departureAt < now` and status ∈ `pending\|waitlisted\|approved` (cancelled/rejected: no badge). Pure helper `isBookingDepartureOverdue` (injectable `now` for tests). | web |
| UX-BKG-47 | **Urgency scan cues (badge-only, no sort):** single urgency slot — Overdue ≻ Soon (`0 ≤ departure−now < 48h`) ≻ Aging (`pending\|waitlisted` and `now−submittedAt ≥ 48h` as muted submitted-line suffix). Client helpers only; no API/sort changes (UX-BKG-33). | web row |
| UX-BKG-48 | **Optional inline Approve only** (no Reject / Waitlist / Cancel on row). Sibling `<button>` (not nested in select hit-target); `stopPropagation`. Desktop: every eligible pending\|waitlisted row when feature on; mobile (`<lg`): selected row only. Same `approve` runner as inspection. Kill switch `BOOKINGS_INLINE_APPROVE_ENABLED`. | web row |
| UX-BKG-49 | **Lightweight queue freshness:** `visibilitychange` → visible soft-refetch (bump `fetchNonce`, preserve bulk selection). Cooldown **45s** since last successful fetch; skip while `actionBusy` / `loadingMore` / reject|bulk dialog open. No polling, no websocket. | web page |
| UX-BKG-50 | **Transport on inspection only (list-projection restore):** do **not** put `registrationIntake` on `listBookings` / `BOOKING_LIST_SELECT` (BK-SAFE-01 + `FORBIDDEN_LIST_JSON_BLOB_FIELDS`). Row meta must **not** render transport. Operators read transport via inspection/detail: `GET /bookings/{bookingId}` (ops) returns projected fields **plus** `registrationIntake`; Command Center loads detail when a row is selected (desktop split + mobile sheet). Tour-workspace transport roster that still calls list-only may show `—` until a dedicated transport projection lands. | API detail + web inspection |
| UX-BKG-32 | Facet **Upcoming** window beside tour chips. **UX-BKG-45:** segmented **7 / 14 / 30** chips → `applyBookingsDepartureWindowChip` → `applyDepartureWindow` (membership preserve). KPI / preset default remain **7**. | URL + chrome |
| UX-BKG-33 | **Badge-only** — no secondary overdue sort in P4b (avoids fighting keyset/`sort=submittedAt`). | decision |
| UX-BKG-34 | Body state `emptyUpcoming` when list empty and `departureWithinDays` set (copy distinct from `emptyFiltered`). | gate + i18n |

**UX-BKG-45 (2026-08-07):** Chrome exposes only `{7,14,30}` via `BOOKINGS_DEPARTURE_WINDOW_DAYS`. URL param remains `departureWithinDays` (API 1..30). Tap active chip clears L2; other values in URL still filter but light no chip. No ISO date picker. KPI `departures7d` + preset Upcoming stay fixed at 7.

**UX-BKG-51 (2026-08-07) — One Upcoming mental model (copy/chrome only):**

| Role | Control | Query (unchanged) |
| ---- | ------- | ----------------- |
| **Primary** | Departure window chips **7 / 14 / 30** | `departureWithinDays=N` (preserve status/layout/sort) |
| **Shortcut** | KPI **Leaving in 7d** | `days=7` + `membership=portfolio` (`status=all`) |
| **Shortcut** | Preset **Focus: next 7 days** | `days=7` + `sortHint=departureAt` (preserve status; clear search/payment) |
| **Layout only** | **By departure** | `layout=timeline` — groups by UTC day; **does not** set L2 |

Operator copy must not imply KPI / preset / timeline are separate “upcoming products.” Optional muted chrome when L2 on: `Window: {N}d`. **No** API / URL key / `applyDepartureWindow` semantics change.

**UX-BKG-52 (2026-08-07) — Lifecycle action safety (keep speed):**

| Action | Protection |
| ------ | ---------- |
| **Cancel** | Confirm dialog (guest + tour; irreversible). No reason field. |
| **Inline Approve** | Arm → confirm on same control (~3s timeout / blur / Esc / other row clears arm). First click does **not** POST. |
| **Inspection Approve** | One-click (context already selected). |
| **Waitlist** | One-click (soft / recoverable). |
| **Reject** | Unchanged dialog (UX-BKG-21). |
| **Bulk approve** | Unchanged confirm (UX-BKG-22). |

No undo toast in 52. No API changes.

**Out of P4b:** forcing `departureAt ≥ now` on default pending query; P4c history scope.

**Verify:** `WEB-9.5-11` + existing body-state tests.

**UX-BKG-53 (2026-08-07) — Chrome progressive disclosure (keep all capabilities):**

**Goal:** First screen understandable in ≤10 seconds without removing features.

| Tier | Controls | Disclosure |
| ---- | -------- | ---------- |
| **Primary** | Queues · Departure window 7/14/30 · Search · Tour chips | Always visible |
| **Signals** | KPI strip (counts + existing shortcuts) | Always visible; visually demoted (compact) — never behind Filters |
| **Secondary** | **Display** (List · By departure · By tour) | Popover / menu — not peer to Queues/window |
| **Advanced** | Status · Payment · Sort · Show all tours · Clear | Behind **Filters** on **all** breakpoints |

**Wireframe:**

```text
KPI (compact signals)
Queues + Departure window
Search · Filters · Display
Tour chips
List / board / timeline body
```

**Copy:** `layout.inbox` → **List**; `layoutLabel` / Display trigger → **Display**. UX-BKG-51 query writers unchanged. Show-all-tours moves into Filters panel (capability retained).

**Helper:** `bookingsAdvancedFiltersDirty` drives Filters dirty badge (payment / `tourChipScope=all` / fine-grain status / approvedWithinDays). Omits `sort` so Focus / By-departure Display do not false-positive the badge.

**Verify:** `WEB-9.5-14` chrome hierarchy assertions + existing preset/layout/window tests.

**UX-BKG-54 (2026-08-07) — First-time operator clarity (copy only):**

**Goal:** New operator understands the page without training. No tutorials / coach marks. No query or business-logic changes.

| Area | Change |
| ---- | ------ |
| Page subtitle | Decide who’s in — pending and waitlisted need action |
| Queues | Preset **Leaving soon (7d)**; muted `presetsHint`; Work queue / History aria |
| Status / KPI | **Waitlisted** (state) vs **Waitlist** (action); KPI aria for Pending / Waitlisted |
| List / Decide | Inbox → **Queue**; Inspection → **Decide**; select + actions helper lines |
| Empty states | Caught-up / clear-filters / widen-window guidance |
| History hint | Align with History queue wording |

**Verify:** `WEB-9.5-14` string locks + existing CC suite.

**UX-BKG-55 (2026-08-07) — Dense queue list rows (style only):**

**Problem:** Per-row bordered cards (`rounded-lg border` + padding) reduce scan density and fight the `inbox_table` / task-queue mental model.

**Solution:** Compact **selectable list rows** inside one list surface:

| Rule | Detail |
| ---- | ------ |
| Chrome | No per-row card radius/border; hairline dividers (`border-b`) |
| Density | ~one primary line + one muted meta line; badges in a horizontal trail |
| Selection | Start accent bar + muted fill (not thick card ring) |
| Capacity | Inline `N/max` in meta; omit capacity bar on the row (bar remains available in Decide/inspection if needed later) |
| Actions | Inline Approve stays sibling; compact `size="sm"` |

No query / API / action-semantics change.

**Verify:** row source contract in `WEB-9.5-14` + CC suite.

---

#### Phase P4c — Explicit history + chip escape hatch (**shipped** 2026-08-07)

| ID | Change | Surfaces |
| -- | ------ | -------- |
| UX-BKG-35 | `GET /bookings/summary?tourChipScope=ops\|all` (default **ops** = P4a predicate). Shared `finalizeBookingTourChips(drafts, scope)`. Command Center URL `tourChipScope=all` + **Show all tours** toggle refetches summary. | contracts parser · API · BFF forward · web |
| UX-BKG-36 | When `status=all`, muted history hint under filter chrome (no negative departure window). | i18n + filter strip |
| UX-BKG-37 | Finance tour filter keeps **default ops** summary (same predicate, no duplicate client filter). No separate finance escape in P4c — bookings CC owns `tourChipScope=all`. | finance unchanged fetch |

**Verify:** `parseBookingsSummaryQuery` + chip finalize scope + `WEB-9.5-12`.

---

#### Phase P4d — Ops path closure (**shipped** 2026-08-07)

See **§11.12**. Presets (UX-BKG-38) + thin timeline / **By Tour** layouts (UX-BKG-39, UX-BKG-44). Full drag Kanban / calendar deferred past path.

---

#### Execution order & gates

```text
P4a → P4b → P4c → P3b-a → P4d  ✅ path complete
P3b-audit (optional) — not on critical ops-scope path
```

| Gate | When |
| ---- | ---- |
| Fast-track | After each sub-phase: static review + targeted specs |
| Full gate | Only on explicit YES |
| Doc-first | Any `apps/api` / contracts change updates this § before code |

**Non-goals for P4 path:** Approve-then-Pay phases 2–5; inventing audit timeline; replacing pending default with future-only; localStorage saved views; drag-and-drop Kanban (shipped `layout=board` is **By Tour** grouping only — UX-BKG-44).
