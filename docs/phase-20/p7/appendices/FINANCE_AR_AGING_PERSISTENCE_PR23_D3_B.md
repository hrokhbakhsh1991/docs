# AR aging persistence + read models (PR23-D3-B contract)

```yaml
doc_id: FINANCE_AR_AGING_PERSISTENCE_PR23_D3_B
version: "2026-08-09-v1"
status: READY_FOR_PR23_D3_B_IMPLEMENTATION
phase: PR23-D3-B
related:
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_SEMANTICS_PR23_D3_A.md
  - docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md
  - docs/phase-20/p7/appendices/FINANCE_TOUR_COLLECTION_REPORT_PR23_D2.md
locks:
  money_sot: registration_invoice_compile_only
  aging_anchor: first_positive_remaining_v1
  collection_mode: manual_offline_first
  online_gateway: forbidden
  refund_psp: forbidden
  sla_dunning: forbidden
  ui: out_of_scope
  csv_export: deferred_D3_C
```

## Purpose

Implementation contract for **persisting `arOpenedAt`** and **exposing aging on FinanceService read models**.

Builds on D3-A semantics. **No UI. No CSV (D3-C). No code in this slice document.**

## Product boundary (hard)

Manual/offline collection only.

```text
Manual Payment → Pending → Receipt review → Paid
                 Pending → Cancelled
```

Forbidden: online/PSP/gateway, refund/chargeback, settlement redesign, ledger-as-AR, payment-sum debt, SLA/dunning, automated collection.

---

## Decision 1 — Persistence model

### Ownership

New **finance-owned** registration AR side-car table (Prisma + RLS), parallel to existing finance tables (`payments`, `finance_schedules`, `finance_recon_*`).

**Recommended name:** `finance_registration_ar_state`  
**Map:** `@@map("finance_registration_ar_state")`

Do **not** add AR columns onto `operator_registrations` (booking surface). Do **not** store remaining/total money on this table (money always recompiled).

### Required columns

| Column | Type | Notes |
| ------ | ---- | ----- |
| `tenant_id` | uuid | Tenant isolation |
| `registration_id` | uuid | Registration key (logical FK; no money cascade) |
| `ar_opened_at` | timestamptz null | Current open episode; **null = not in open AR** |
| `ar_opened_at_source` | text null | `observed_transition_v1` \| `backfill_provisional_v1` |
| `updated_at` | timestamptz | Row maintenance |
| `created_at` | timestamptz | Row first insert |

**Optional (D3-B allowed, not required for MVP):**

| Column | Notes |
| ------ | ----- |
| `ar_closed_at` | Last time remaining crossed to ≤ 0 (audit) |
| `aging_anchor` | Default `first_positive_remaining_v1` (denormalized constant OK) |

### Keys & isolation

```text
PRIMARY KEY (tenant_id, registration_id)
INDEX (tenant_id, ar_opened_at)  -- outstanding aging scans
```

- All reads/writes via existing tenant RLS session (`withTenantRls`).
- Repository port methods on `FinanceRepositoryPort` (or narrow `FinanceArStatePort` injected into FinanceService — prefer **extend FinanceRepositoryPort** for D3-B simplicity).

### Relation to invoice / registration

| Concept | Relation |
| ------- | -------- |
| Invoice compile | Money SoT; AR table never stores balances |
| Registration | Identity key only; display via `RegistrationDisplayPort` |
| Payment / receipt | **No FK**; lifecycle must not own AR row |

### Migration strategy

1. Add empty table (expand/contract safe).  
2. Deploy code that **observes** transitions on money-affecting paths + read-path lazy observe.  
3. Run **idempotent backfill** job/script per tenant (or gated admin command).  
4. After backfill coverage gate, outstanding aging API may require non-null `arOpenedAt` for bucket fields (still allow null → omit age during migration).

---

## Decision 2 — Transition detection

### Semantic trigger (D3-A)

```text
balanceDueMinor:  <= 0  →  > 0
  ⇒ open episode:
       arOpenedAt = now (FinanceClock / host clock)
       arOpenedAtSource = observed_transition_v1

balanceDueMinor:  > 0  →  <= 0
  ⇒ close episode:
       arOpenedAt = null
       arOpenedAtSource = null
       optional arClosedAt = now
```

### Where detected

**Authoritative observation function** (FinanceService private or domain+repo):

```text
observeRegistrationArState(tenantId, registrationId, balanceDueMinor, nowIso)
```

Called **after** invoice compile is known, on:

| Path | Why |
| ---- | --- |
| Receipt approve (Paid) | Remaining may drop to 0 |
| Obligation override | Remaining may open or close |
| Prepayment record | Remaining may drop |
| Schedule generate / waive / reschedule if it changes compile inputs | Remaining may change |
| **Outstanding / aging read path (lazy)** | Safety net for missed writes / historical open debt |

**Not** called as the meaning of:

- `createManualPayment` alone (Pending does not create AR)
- `cancelPendingManualPayment` alone (Cancelled does not create/clear AR except via subsequent compile remaining)
- Ledger outbox writes
- Receipt reject (no Paid change)

Cancellation / pending create may still invoke observe **only if** the service recompiles invoice afterward and passes `balanceDueMinor` — the observe function keys off remaining, not payment status.

### Duplicate writes / idempotency

Single row per `(tenantId, registrationId)`.

| Current state | Incoming remaining | Action |
| ------------- | ------------------ | ------ |
| `arOpenedAt` null, remaining > 0 | Open | `UPDATE … SET ar_opened_at = now, source = observed_transition_v1 WHERE ar_opened_at IS NULL` (insert if missing) |
| `arOpenedAt` set, remaining > 0 | No-op | Do **not** refresh `arOpenedAt` |
| `arOpenedAt` set, remaining ≤ 0 | Close | Clear open fields; set optional `arClosedAt` |
| `arOpenedAt` null, remaining ≤ 0 | No-op | |

**Idempotency rules:**

1. Open is conditional on `ar_opened_at IS NULL`.  
2. Concurrent opens: one winner via conditional update / upsert; both may compile same remaining — safe.  
3. Observed transition **never overwrites** an existing open `arOpenedAt` (including provisional backfill) while remaining stays > 0.  
4. Re-open after close: prior close left `arOpenedAt` null → new open gets **new** `now` + `observed_transition_v1`.

### Clock

Use FinanceService `FinanceClockPort` (or host clock) — same family as other finance audit times. Persist timestamptz UTC.

---

## Decision 3 — Backfill

### Universe

Registrations where:

```text
compile.balanceDueMinor > 0
AND (no AR row OR arOpenedAt IS NULL)
```

### Strategy

1. **Batch** by tenant, keyset on `registration_id` (or reuse outstanding candidates).  
2. For each candidate: compile invoice; if remaining > 0 and open null → set:
   - `arOpenedAt = registration.createdAt` (provisional bootstrap per D3-A)
   - `arOpenedAtSource = backfill_provisional_v1`
3. **Deterministic:** same inputs → same provisional timestamp (registration createdAt).  
4. **Idempotent:** skip if `arOpenedAt` already set (any source).  
5. **Auditability:** source tag mandatory; optional job run id in logs/metrics only (not required on row for D3-B).  
6. **Does not claim historical truth:** docs + API field `arOpenedAtSource` expose provisional nature.

### Forbidden backfill clocks

Last payment, receipt review, ledger event, cancel event, “now”.

---

## Decision 4 — FinanceService read model

### Item shape (contract)

```ts
type OutstandingAgingItem = {
  registrationId: string;
  identity: {
    memberDisplayName: string | null;
    tourTitle: string | null;
    tourId: string | null;
  };
  invoice: {
    totalMinor: string;
    paidMinor: string;
    remainingMinor: string;
    currency: string;
  };
  bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  /** D1 sort clock — not aging */
  registrationOpenedAt: string;
  arOpenedAt: string | null;
  arOpenedAtSource: "observed_transition_v1" | "backfill_provisional_v1" | null;
  ageDays: number | null;
  agingBucket: "current" | "1_30" | "31_60" | "60_plus" | null;
};

type OutstandingAgingPage = {
  asOf: string;
  agingAnchor: "first_positive_remaining_v1";
  items: OutstandingAgingItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
```

### Inclusion

Same as D1: `invoice.remainingMinor > 0` only.

### Pagination / ordering

- Keyset pagination (no offset).  
- Default order: `ageDays DESC NULLS LAST`, then `registrationId ASC`  
  (null age = not yet backfilled; sort last).  
- Cursor must encode sort keys used (e.g. `ageDays` or `arOpenedAt` + `registrationId`) **plus** bind to response `asOf` so continuation does not recompute ages with a new clock.  
  **Contract:** client sends prior `asOf` on continuation **or** server embeds `asOf` inside opaque cursor. Prefer **opaque cursor includes asOf**.

### Currency boundaries

- Each item carries `currency`.  
- Future bucket summary API: **one series per currency**; never sum cross-currency.  
- D3-B may ship item list only; bucket aggregate endpoint optional within B if cheap.

### HTTP (D3-B allowed)

```http
GET /finance/reports/outstanding-aging
```

Response includes `asOf`, `agingAnchor`, page shape above.

BFF proxy only — no aggregation in BFF.

D1 outstanding list may remain unchanged or gain optional aging fields in a later pass; D3-B should not break D1 contract. Prefer **new** aging report endpoint.

---

## Decision 5 — Aging helpers

Pure domain (finance-core), server-only:

```ts
computeArAgeDays(arOpenedAt: Date, asOf: Date): number | null
resolveArAgingBucket(ageDays: number): "current" | "1_30" | "31_60" | "60_plus"
```

### Rules (from D3-A)

| ageDays | bucket |
| ------- | ------ |
| 0 | `current` |
| 1–30 | `1_30` |
| 31–60 | `31_60` |
| ≥ 61 | `60_plus` |

- `ageDays = floor((asOf − arOpenedAt) / 86400000)` in **UTC** millisecond day floors.  
- **Timezone documented:** UTC calendar-day flooring via epoch ms / 86400000 (not tenant local TZ in D3-B).  
- Deterministic for fixed `(arOpenedAt, asOf)`.  
- If `arOpenedAt` null → `ageDays` null, `agingBucket` null.

---

## Decision 6 — Required tests

| # | Case |
| - | ---- |
| T1 | First positive remaining → open with `observed_transition_v1` |
| T2 | Remaining stays > 0 → second observe does not move `arOpenedAt` |
| T3 | Fully paid (remaining ≤ 0) → close; later remaining > 0 → **new** `arOpenedAt` |
| T4 | Cancel pending payment alone does not open AR; remaining still from invoice |
| T5 | Create manual Pending payment alone does not open AR if remaining already open / if remaining still 0 |
| T6 | Backfill sets `backfill_provisional_v1` + registration createdAt; skips if already open |
| T7 | Multi-currency: items keep currency; no cross-sum in helpers/summary |
| T8 | Page cursor continuation with **fixed asOf** yields stable `ageDays` |
| T9 | Bucket edge: 0, 1, 30, 31, 60, 61 |
| T10 | No gateway/PSP/refund symbols in AR module surface |
| T11 | Money still from compile; AR table has no balance columns |

---

## Decision 7 — Non-goals (confirm)

- No online payment / PSP / gateway  
- No automated collection / dunning  
- No SLA language  
- No UI  
- No AR CSV (→ D3-C)  
- No settlement engine redesign  
- No refund/chargeback  
- No treating D1 `occurredAt` as aging without rename/`registrationOpenedAt` clarity  

---

## Invariants

1. Invoice compile = only money SoT.  
2. `arOpenedAt` = only debt-age SoT for open episodes.  
3. Open write is idempotent (`IS NULL` guard).  
4. Payment lifecycle events are not AR events.  
5. Ledger ignored for AR.  
6. FinanceService computes age/bucket; BFF/UI consume.  
7. Provisional backfill always tagged.  
8. Manual/offline product boundary preserved.  
9. One `asOf` per aging page (cursor-bound).

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Missed transition on rare write path | Lazy observe on aging/outstanding reads |
| Provisional backfill ≠ true first unpaid | Source tag + docs; no silent upgrade |
| Cursor + asOf mismatch | Embed asOf in opaque cursor |
| Confusing D1 occurredAt vs arOpenedAt | Distinct field names on aging DTO |
| Scope creep to CSV/UI | Explicit D3-C / UI deferral |
| Storing remaining on AR row | Schema review forbid |

---

## PR23-D3-B implementation boundary

### In scope

1. Prisma model + migration for `finance_registration_ar_state`  
2. Repository port: get/upsert/observe/backfill batch helpers  
3. FinanceService `observeRegistrationArState` + wire to money-affecting commands + lazy read  
4. Domain helpers `computeArAgeDays` / `resolveArAgingBucket`  
5. `listOutstandingAging` (or equivalent) + HTTP `GET /finance/reports/outstanding-aging` + BFF proxy  
6. Idempotent backfill entrypoint (script or internal admin-safe job — no UI)  
7. Tests T1–T11  
8. Docs: this contract + D3-A link; status → ready for D3-C  

### Out of scope

- Operator UI / Command Center aging panels  
- AR CSV export  
- Tour aging aggregate UI  
- Gateway/PSP fields  
- Corrective rewrite of provisional timestamps beyond tagged backfill  
- Multi-episode history table (optional `arClosedAt` only)

### Exit / next

`READY_FOR_PR23_D3_C` when aging read + persistence + tests green.

D3-C: AR CSV from aging/outstanding rows (`arOpenedAt`, `ageDays`, `agingBucket`, `arOpenedAtSource`, `asOf`).

---

## Status

`READY_FOR_PR23_D3_B_IMPLEMENTATION` — persistence and read-model contract locked; coding may start within the boundary above.
