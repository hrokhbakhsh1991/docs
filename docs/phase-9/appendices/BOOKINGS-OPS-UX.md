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
(app)/bookings/[id]               ← Deep link → opens inbox + inspection panel focused
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
