# AR aging semantics lock (PR23-D3-A)

```yaml
doc_id: FINANCE_AR_AGING_SEMANTICS_PR23_D3_A
version: "2026-08-09-v1"
status: READY_FOR_PR23_D3_B
phase: PR23-D3-A
related:
  - docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md
  - docs/phase-20/p7/appendices/FINANCE_TOUR_COLLECTION_REPORT_PR23_D2.md
locks:
  money_sot: registration_invoice_compile_only
  aging_anchor: arOpenedAt_first_positive_remaining
  payment_lifecycle: not_ar
  ledger: not_ar
  collection_mode: manual_offline_first
  online_gateway: forbidden
  refund_psp: forbidden
  mutation_in_d3: forbidden
```

## Purpose

Lock **AR aging semantics** before any D3-B storage/API/UI work.

This document is the implementation contract. No code ships under D3-A.

## Product boundary (hard)

Denali Finance is **manual/offline collection only**.

In scope lifecycle for collection ops (not AR money math):

```text
Manual Payment → Pending → Receipt review → Paid
                 Pending → Cancelled
```

**Forbidden in AR aging / AR reporting vocabulary and design:**

- Online payment / PSP / gateway collection
- Gateway Failed / capture / chargeback
- Automated collection / dunning engines
- Refund / credit-note / settlement-engine redesign
- Using ledger as AR
- Using payment row sums as debt

---

## Decision 1 — Aging anchor

### Confirmed

```text
arOpenedAt = first moment invoice.balanceDueMinor became > 0
  for that registration (tenant-scoped), under Invoice compile SoT
```

**Accept.** This is the only anchor that means “debt age” rather than booking age or payment activity.

### Rejected alternatives

| Candidate | Status | Why |
| --------- | ------ | --- |
| Registration `createdAt` | Rejected as aging SoT | Booking/registration age ≠ debt age. May remain D1 **sort** clock (`registrationOpenedAt`) only — never marketed as aging. |
| Invoice “createdAt” | Rejected | Not present on `RegistrationInvoiceReadModel`; inventing it creates a second SoT. |
| Last payment / paidAt / cancel event | Rejected | Collection activity ≠ debt origin; Cancelled must not reset age. |
| Receipt createdAt / reviewedAt | Rejected | Proof workflow, not AR open. |

### Anchor invariants

1. **Money SoT unchanged:** `balanceDueMinor` still comes only from `compileRegistrationInvoice` (obligation + paid wallet path). Aging does not recompute money.
2. **`arOpenedAt` is a time fact about remaining**, not about payments. Creating a Pending manual payment does **not** by itself set `arOpenedAt` unless compile remaining becomes > 0 (usually via obligation already present).
3. **Clearing remaining** (`balanceDueMinor` → 0) ends the open AR episode for reporting inclusion (row leaves outstanding lists). A **later** return to remaining > 0 starts a **new** episode → new `arOpenedAt` (see historical rules).
4. **Cancelled payments** never set or clear `arOpenedAt`; invoice remaining does.
5. Version tag for reports/exports: `agingAnchor = first_positive_remaining_v1`.

---

## Decision 2 — asOf, ageDays, buckets

### asOf

```text
asOf = server report generation instant (FinanceService clock / host clock)
```

- Single `asOf` ISO-8601 for a report response / export file.
- Not browser `Date.now`.
- Not “last payment time.”
- Cursor pagination within one request shares the same `asOf` (do not re-age mid-page with a new clock).

### ageDays

```text
if remainingMinor <= 0 → registration not in AR aging universe
if arOpenedAt is null → ageDays = null (see historical policy)
else:
  ageDays = floor( (asOf − arOpenedAt) / 1 calendar day )
  ageDays = max(ageDays, 0)
```

- Use UTC day boundaries unless a later product decision localizes; D3-B must document the chosen day boundary in code comments + this doc revision.
- No fractional days in bucket assignment.

### Buckets (locked edges)

| Bucket id | ageDays | Meaning (operator, non-SLA) |
| --------- | ------- | --------------------------- |
| `current` | `0` | Opened today (asOf calendar day) |
| `1_30` | `1`–`30` | Open 1–30 days |
| `31_60` | `31`–`60` | Open 31–60 days |
| `60_plus` | `≥ 61` | Open 61+ days |

**Vocabulary lock:** bands are **reporting groups**, not SLA. Forbidden copy: overdue, late, failed, escalation, dunning.

Future summary row shape (D3-B+; not implemented in D3-A):

```ts
type OutstandingAgingBucket = {
  bucket: "current" | "1_30" | "31_60" | "60_plus";
  registrationsCount: number;
  outstandingMinor: string;
  currency: string;
};
```

Multi-currency: **never** sum across currencies; one bucket series per `currency`.

---

## Decision 3 — Historical registrations without stored `arOpenedAt`

### Problem

Existing tenants have outstanding remaining today but no persisted “first positive remaining” event.

### Chosen strategy (hybrid)

| Phase | Behavior |
| ----- | -------- |
| **D3-B backfill (required for ship)** | One-time / idempotent **derived backfill**: for each registration with compile `balanceDueMinor > 0` and null `arOpenedAt`, set `arOpenedAt` to a **documented provisional** value (see below), tagged `arOpenedAtSource = backfill_provisional_v1`. |
| **Ongoing (after B)** | When remaining transitions from `≤ 0` → `> 0`, set `arOpenedAt = now` with `arOpenedAtSource = observed_transition_v1`. |
| **Nullable window** | During migration only: APIs may omit aging fields if `arOpenedAt` still null; **must not** invent buckets from registration `createdAt` silently. |

### Provisional backfill value (locked for D3-B)

Prefer, in order:

1. **Earliest known obligation-effective time** if already recoverable without new invention (e.g. registration `createdAt` when obligation is tour/canonical and no earlier paid-full state can be proven) — labeled provisional.
2. Else **registration `createdAt`** as provisional open clock.

**Explicit:** provisional backfill is **not** perfect Option C history; it is a one-way bootstrap so managers get bands. `agingAnchor` + `arOpenedAtSource` must appear on export so analysts know.

**Forbidden:** backfill from last payment, receipt review, or ledger event timestamps.

### Re-open after fully paid

If remaining returns to > 0 after having been 0:

- Set new `arOpenedAt = transition time`
- `arOpenedAtSource = observed_transition_v1`
- Do not keep the old episode’s age

---

## Decision 4 — Domain ownership

| Concern | Owner | Not owner |
| ------- | ----- | --------- |
| Money (total/paid/remaining) | Invoice compile via FinanceService | BFF, UI, ledger, payment sum |
| `arOpenedAt` persistence / transition | Finance domain + repository (D3-B) | BFF |
| `ageDays` / bucket assignment | **FinanceService** pure helpers at read time from `(arOpenedAt, asOf)` | Browser, BFF |
| Outstanding + aging enrichment | FinanceService read models | |
| Aging summary / tour aging rollups | FinanceService | |
| AR CSV | FinanceService → HTTP → BFF proxy | Ledger export path |
| UI labels | Web i18n consuming API buckets | Must not recompute age |

**Invariant:** BFF/UI only consume; no client-side aging math.

---

## Decision 5 — Data model impact (analysis only)

### Required for D3-B (minimum)

Per registration (tenant-scoped), when participating in AR:

| Field | Required? | Notes |
| ----- | --------- | ----- |
| `arOpenedAt` | Yes once backfilled / observed | timestamptz |
| `arOpenedAtSource` | Yes | enum/string: `observed_transition_v1` \| `backfill_provisional_v1` |

### Optional / later

| Field | Notes |
| ----- | ----- |
| `arClosedAt` | Optional audit of last transition to remaining = 0 |
| `arEpisodeId` | Only if multi-episode history is required (out of D3-B default) |

### Where to store (D3-B chooses one; D3-A constraint)

Acceptable:

- Dedicated finance AR projection table keyed by `(tenantId, registrationId)`, or
- Column(s) on an existing finance-owned registration finance side-car — **not** inventing money on booking settlement.

Forbidden:

- Storing “remaining” as a competing SoT (always recompile money)
- Storing gateway/PSP ids

### Migration risks

- Backfill volume on large tenants → batch + idempotent
- Wrong provisional clock → communicate via `arOpenedAtSource`
- Changing anchor later → bump `agingAnchor` version; never silently remap history without a migration note

### Relation to D1 `occurredAt`

- D1 `occurredAt` remains **list ordering** (registration open / candidate clock).
- Aging uses **`arOpenedAt`** only.
- Do not rename D1 field to imply aging until D3-B dual-exposes clearly named fields.

---

## Non-goals (explicit)

- No online payment / PSP / gateway
- No automated collection / reminders engine
- No settlement engine rewrite
- No refund / chargeback / credit-note flows
- No ledger-as-AR
- No payment-row debt math
- No UI / API implementation in D3-A
- No SLA / “overdue” product language

---

## Invariants (summary)

1. Invoice compile = only money SoT.  
2. `arOpenedAt` = only debt-age SoT (`first_positive_remaining_v1`).  
3. Payment lifecycle ≠ AR aging.  
4. Ledger ≠ AR.  
5. Manual/offline collection boundary preserved.  
6. FinanceService owns age/bucket/export reads; BFF/UI consume.  
7. No silent aging from registration `createdAt` without `arOpenedAtSource` disclosure.  
8. Currency isolation in bucket sums.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Provisional backfill ≠ true first unpaid | Tag source; document; allow later corrective migration |
| asOf drift across pages | Fix asOf per response |
| Managers treat bands as SLA | Copy + doc vocabulary lock |
| Dual clocks confuse ops | Distinct names: `registrationOpenedAt` vs `arOpenedAt` |
| Scope creep into gateway AR | Product boundary section; reject PSP fields in review |

---

## PR23-D3-B implementation boundary

**In scope for D3-B:**

1. Persist `arOpenedAt` + `arOpenedAtSource` (chosen storage).  
2. Transition hook: when compile remaining crosses to > 0, set observed `arOpenedAt` if null/new episode.  
3. Idempotent provisional backfill for existing outstanding rows.  
4. Pure helpers: `ageDays`, `agingBucket` from `(arOpenedAt, asOf)`.  
5. Enrich D1 outstanding item (or adjacent read) with `arOpenedAt`, `ageDays`, `agingBucket`, `asOf`, `agingAnchor`.  
6. Optional: `GET` aging summary buckets (still FinanceService).  
7. Tests: transition semantics, bucket edges, backfill source tag, no payment-sum aging, no gateway terms.  
8. Docs update pointing at this D3-A lock.

**Out of scope for D3-B (→ D3-C or later):**

- AR CSV export file (contract may be sketched; implement in D3-C)
- Operator UI for aging charts
- Tour-level aging UI
- Corrective rewrite of provisional history beyond tagged backfill
- Multi-episode ledger of AR opens/closes (unless trivial `arClosedAt`)

**D3-C (preview):** AR CSV = D1 columns + `arOpenedAt` + `ageDays` + `agingBucket` + `arOpenedAtSource` + `asOf`; never ledger/payment CSV as AR.

---

## Status

`READY_FOR_PR23_D3_B` — semantics locked; implementation may proceed only within D3-B boundary above.
