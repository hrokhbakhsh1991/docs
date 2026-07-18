# Phase 9.5 — Registration Command Center (Bookings Ops UX)

```yaml
ux_spec_id: BOOKINGS-OPS-UX
version: "2026-06-08-v1"
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

| View ID              | Label      | Best for                                |
| -------------------- | ---------- | --------------------------------------- |
| `inbox_table`        | Inbox      | Daily ops — sortable table, bulk select |
| `tour_board`         | Tour board | Kanban columns × tour swimlanes         |
| `departure_timeline` | Timeline   | Urgency — group by tour departure date  |

**MVP (9.5-R2):** `inbox_table` required for closure.  
**9.5-R4 (pre-9.8 optional):** `tour_board` + `departure_timeline`.

---

## 3. Layout wireframe

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ KPI strip: Pending (12) · Approved today (4) · Departures 7d (3) · Waitlist (5) │
├─────────────────────────────────────────────────────────────────────────┤
│ [Search guest/email/phone]  [Tour chips ▼]  [Status ▼]  [Dates ▼]  Table|Board|Timeline │
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
