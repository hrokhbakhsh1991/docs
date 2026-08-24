# DP-1 EXECUTION PLAN

```yaml
plan_id: DP-1-EXECUTION-2026-08-24
program: Denali Product Completion — Phase DP-1
mode: PLANNING_ONLY — test-first specification; no production implementation in this run
authority_ledger: docs/dev/denali-product-completion-plan.md
authority_impact: docs/dev/denali-prod-04-11-impact-report.md
architect_approval_date: 2026-08-24
status: READY_FOR_TEST_FIRST_IMPLEMENTATION
production_code_changed: NO
tests_changed: NO
db_changed: NO
commit: NO
push: NO
```

---

## Approved decisions

Recorded **as approved by Architect/Product on 2026-08-24**. Do not reinterpret.

### DEN-PROD-01 — Payment deadline duration

| Field | Approved value |
|-------|----------------|
| **Workspace default** | **24 hours** after operator approval (`approvedAt`) |
| **Per-tour override** | Canonical `pricing.paymentDeadlineHours` (integer hours, `> 0`). When null/absent → inherit workspace default |
| **Workspace settings override** | Denali tenant `TenantConfig` key `denali.payment_deadline_policy` may set workspace default hours (same semantics as tour inherit root) |
| **Manual / no expiry** | **Not** default. Only when tour explicitly sets `pricing.paymentDeadlineHours: null` **and** workspace policy `manual: true` (explicit opt-out flag — rare; not used in first-customer seed) |
| **Clock** | **UTC instant** stored as `dueAt` ISO-8601. UI displays in member/operator locale. Policy duration is wall-clock hours from `approvedAt`, not civil calendar days |
| **Operator extension** | Allowed (DP1-I-03). New `dueAt` must be **strictly after** now; audited |

### DEN-PROD-02 — Does approved-unpaid reserve capacity?

| Field | Approved value |
|-------|----------------|
| **Decision** | **YES — retain current occupancy rule** |
| **Predicate** | `registrationOccupiesSeat` iff `booking.status === "approved"` (unchanged; Urban `confirmed` untouched) |
| **Pairing** | Capacity hold **requires** DEN-PROD-04 expiry cancel to release seat. No indefinite hold without expiry |
| **Paid / waived** | `paymentStatus` `paid` or free-collection waive: still `approved`, still occupies until cancelled or tour completes (occupancy unchanged from today) |

### DEN-PROD-04 — Payment expiry representation

| Field | Approved value |
|-------|----------------|
| **Model** | **D + A** — Finance **Payment Hold** + booking **`approved → cancelled`** |
| **Hold aggregate** | Finance-owned `FinancePaymentHold` (table `finance_payment_holds`). One active hold per `(tenantId, registrationId)` while lifecycle active |
| **Hold statuses** | `open` → `satisfied` \| `expired` \| `extended` (extended returns to `open` with new `dueAt`) |
| **`paymentDueAt`** | **Column on hold row** (`due_at`). Single writer: Finance hold service. Bookings **reads** projection for list/detail; does not write `dueAt` |
| **Expiry consequence** | `booking.status`: `approved` → `cancelled`. **`cancelSource`**: `payment_deadline` (additive on `operator_registrations`) |
| **No new booking status** | No `payment_expired` wire status. DEC-CW-04 display map unchanged (`cancelled` → semantic `cancelled`) |
| **Partial payment** | If invoice `remainingMinor > 0` at expiry evaluation → **expiry proceeds** (cancel + release) |
| **Waitlist on expiry** | **YES — auto-promote** one waitlisted registration per freed seat (FIFO by `submittedAt`, existing promote API semantics + capacity re-check) |
| **Urban / cert-club / guest-club** | **No changes** |

### DEN-PROD-11 — Obligation materialization timing

| Field | Approved value |
|-------|----------------|
| **Decision** | **Freeze Commercial Quote on approve** (amend **DEC-CQ-001** / CQ-008) |
| **Payable SoT** | Active `finance_commercial_quotes` version (`payableMinor`, `grossMinor`, `source`, immutable chain) |
| **Trigger** | Synchronous in **same host transaction** as booking approve (and Denali `registrationApproval: auto` approve path). **Not** `reactAfterApprove` (non-durable) |
| **Free / zero obligation** | `applyFreeCollectionPayment` after approve: **no Payment Hold** (or hold `satisfied` immediately); quote `source=free_collection` if applicable |
| **`dueAt` location** | **Payment Hold only** — not on quote row |
| **Tour price after approve** | **Does not** change member obligation (frozen quote) |
| **Membership change after approve** | **Does not** retro-change quote (DEC-CQ-002 preserved) |
| **Member intake after approve** | Still forbidden (`DN-READ-05`) |
| **Grandfather** | Existing `approved` + `unpaid` rows **without** hold: **no auto-expiry** until optional backfill job (DP1-K-02). Display “no deadline” until backfill |

---

## State model

### Booking lifecycle (unchanged vocabulary)

Statuses: `pending | approved | waitlisted | rejected | cancelled`.

### Payment Hold lifecycle (new — Finance)

```text
(none on approve skip: free/waived)
open ──(remaining=0)──► satisfied
open ──(dueAt passed + expiry wins)──► expired
open ──(operator extend)──► extended ──► open (new dueAt)
```

Hold `expired` is **terminal** for the hold row. Booking then `cancelled`.

### Payment projection (unchanged)

`paymentStatus`: `unpaid | partial | paid` on `operator_registrations`.

### Commercial Quote (amended trigger)

On approve: create quote version `FROZEN` (active). On first capture: chain `LOCKED` (existing DEC-CQ-003).

### Combined approved-unpaid happy path

```text
pending
  → [approve TX]
      booking: approved + unpaid
      quote: v1 FROZEN (payable = X)
      hold: open, dueAt = approvedAt + policyHours
      seat: CONSUMED
  → [member receipt + operator approve OR manual payment]
      paymentStatus: paid (or partial then paid)
      hold: satisfied
      quote: LOCKED (on first capture)
  OR
  → [expiry worker wins]
      hold: expired
      booking: cancelled, cancelSource=payment_deadline
      seat: RELEASED
      → [optional] waitlist promote → new approved + new hold + new quote freeze
```

### Transition table (booking)

| From | To | Trigger | Legal |
|------|-----|---------|-------|
| `pending` | `approved` | Operator/auto approve | Yes |
| `pending` | `waitlisted` | Operator waitlist | Yes |
| `pending` | `rejected` | Operator reject | Yes |
| `pending` | `cancelled` | Operator cancel | Yes |
| `waitlisted` | `approved` | Promote/approve | Yes |
| `waitlisted` | `rejected` | Operator reject | Yes |
| `waitlisted` | `cancelled` | Operator cancel | Yes |
| `approved` | `cancelled` | Operator cancel **or** payment-deadline expiry **or** (future DP-4 member cancel) | Yes |
| `approved` | `approved` | Payment capture (status unchanged) | Yes |
| `approved` | `*` other | Any | **Illegal** |
| `cancelled` | `*` | Any | **Illegal** (terminal) |
| `rejected` | `*` | Any | **Illegal** (terminal) |

### Illegal concurrent outcomes (must be prevented)

| Attempt | Result |
|---------|--------|
| Expiry + full payment same instant | **Payment wins** if `remainingMinor = 0` inside tour advisory lock; hold → `satisfied`; booking stays `approved` |
| Expiry + partial payment | **Expiry wins** if `remainingMinor > 0` at lock re-read |
| Expiry on already `cancelled` | No-op (CAS 0 rows) |
| Double expiry job | No-op; idempotent outbox |
| Capture after expiry cancel | **Rejected** `FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING` |
| Promote waitlist when capacity full | **Rejected** capacity error; no double promote (S20) |

### Payment / expiry concurrent transition (normative)

```text
BEGIN (tour advisory lock acquired)
  READ booking (must be approved)
  READ invoice remainingMinor
  IF remainingMinor = 0 THEN
    mark hold satisfied; COMMIT; EXIT (expiry aborts)
  ELSE IF expiry predicate (dueAt <= now AND hold open) THEN
    UPDATE hold open→expired
    UPDATE booking approved→cancelled SET cancelSource=payment_deadline
    EMIT outbox payment.hold.expired + registration.cancelled
    [optional] promoteWaitlistOneSeat()
  COMMIT
END
```

Money-path capture must enter the **same tour advisory lock** before posting capture (DP1-F-02).

---

## 20-scenario matrix

All cells are **normative expected outcomes** for DP-1 automated tests. No TBD.

**Legend:** `R`=registration status, `P`=paymentStatus, `H`=hold status, `Q`=quote, `Occ`=seat occupied for tour, `WL`=waitlist effect.

| # | Scenario | R | P | dueAt | Occ | WL | Finance (quote / invoice / hold) | Events / outbox | Portal | Operator |
|---|----------|---|---|-------|-----|----|-----------------------------------|-----------------|--------|----------|
| **1** | Approve → unpaid → deadline created | `approved` | `unpaid` | `T0+24h` | **yes** | — | Q v1 FROZEN payable=X; inv remaining=X; H `open` | `registration.approved`, `payment.hold.scheduled` | Display `accepted`; receipt upload allowed; shows dueAt countdown | Approved row; payment filter unpaid; dueAt column = same instant |
| **2** | Payment before deadline | `approved` | `paid` | historical `T0+24h` | **yes** | — | Q `LOCKED`; inv remaining=0; H `satisfied` | receipt/payment approved (existing) | Paid panel; no upload | Paid; not in outstanding inbox |
| **3** | Payment exactly near deadline | `approved` | `paid` | historical | **yes** | — | Same as S2 if payment wins lock | same | Paid | Paid |
| **3b** | (alt) Expiry wins near deadline | `cancelled` | `unpaid` | historical | **no** | per S6/S7 | Q FROZEN unchanged; inv N/A for active; H `expired` | `payment.hold.expired`, `registration.cancelled` payload `source=payment_deadline` | Closed `data-closed-reason=payment_expired` | Cancelled + reason payment deadline |
| **4** | Expiry without payment | `cancelled` | `unpaid` | historical | **no** | — | H `expired`; Q remains audit chain; no refund | `payment.hold.expired`, `registration.cancelled` | Closed payment_expired | Cancelled reason |
| **5** | Expiry releases capacity | `cancelled` | `unpaid` | — | **no**; catalog `spotsRemaining` += partySize | — | same as S4 | same | Tour shows spots increased on marketing if published | Tour capacity KPI reflects freed seat |
| **6** | Expiry with waitlist | First: `cancelled` (expired guest). Second: `approved` (promoted) | expired `unpaid`; promoted `unpaid` | promoted gets new `T+24h` | net: occupied by promoted party only | **promote 1** FIFO waitlisted→approved | New Q freeze for promoted; new H `open` | cancel + hold.expired + approve + hold.scheduled for promotee | Promoted member sees accepted + dueAt | Waitlist count −1; promoted in approved |
| **7** | Expiry without waitlist | `cancelled` | `unpaid` | — | **no** | **no promote** (queue empty) | H `expired` | cancel events only | Closed payment_expired | Open seat visible in capacity |
| **8** | Payment and expiry concurrent race | **Payment win:** `approved`/`paid`. **Expiry win:** `cancelled`/`unpaid` | per winner | per winner | per winner | per winner | single winner event set | per winner | per winner |
| **9** | Duplicate expiry execution | `cancelled` (unchanged 2nd run) | `unpaid` | — | **no** | no second promote | H stays `expired` | second `payment.hold.expired` insert no-op (idempotent key) | unchanged | unchanged |
| **10** | Partial payment before expiry | `approved` | `partial` | `T0+24h` still active until due | **yes** | — | Q FROZEN; inv remaining>0; H `open` | partial capture events | Upload/waiting + remaining due | Outstanding inbox |
| **10b** | Partial then expiry at due | `cancelled` | `partial` (unchanged) | — | **no** | per queue | No auto-refund (DP-6); captured $ stays; remaining AR voided on cancel | expiry + cancel | Closed payment_expired; show partial paid history if exposed | Cancelled + partial paid note |
| **11** | Operator extends deadline | `approved` | `unpaid` | `T0+48h` (extended) | **yes** | — | H `extended`→`open`; Q unchanged | `payment.hold.extended` audit | New countdown | Extended dueAt visible |
| **12** | Member cancellation before payment | **OUT OF DP-1** — DEN-PROD-09 not in this approval set | — | — | — | — | — | — | — | — |
| **13** | Operator cancellation before payment | `cancelled` | `unpaid` | — (hold `voided` or `satisfied` cancelled) | **no** | no auto-promote unless product adds later | H closed; Q FROZEN not LOCKED | `registration.cancelled` payload `source=operator` | Closed `cancelled` generic | Cancelled |
| **14** | Tour deadline policy changed after approval | `approved` | `unpaid` | **unchanged** `T0+24h` | **yes** | — | Q unchanged | none | Old dueAt | Old dueAt |
| **15** | Timezone / DST boundary | `approved` | `unpaid` | UTC instant correct | **yes** | — | — | — | Local display matches UTC instant | Same API field |
| **16** | Member refresh / relogin | `approved` | `unpaid` | unchanged | **yes** | — | unchanged | — | Same dueAt after reload | — |
| **17** | Operator and member see same dueAt | `approved` | `unpaid` | **identical** ISO in GET booking vs GET me registration | **yes** | — | — | — | `dueAt` field | `dueAt` column |
| **18** | System restart before expiry job | `approved` until due; then S4 | `unpaid`→cancelled | — | per S4 | per S4 | durable hold survives restart | worker resumes | per S4 | per S4 |
| **19** | Delayed worker on already-paid registration | `approved` | `paid` | — | **yes** | — | H `satisfied`; Q LOCKED | **no** expiry events | Paid | Paid |
| **20** | Expired registration cannot double-promote | After S6: only **one** waitlisted becomes approved; second expiry no-op promote if capacity full | — | — | capacity never exceeds max | **at most one** promote per freed seat | — | idempotent promote | — | waitlist depth correct |

**S12 note:** Covered in **DP-4** when DEN-PROD-09 is approved. DP-1 tests **must not** assert member self-cancel.

---

## Task ledger

Status: **DP1-A…K automated implementation `[v]`** (2026-08-24). **DP1-L** contract/integration `[v]`; Playwright E2E still `[ ]`. **DP1-M** browser certification `[ ]` — required for `[x]`, forbidden until then.

Previous: all `[ ]` until test-first implementation begins.

### DP1-A — persistence / schema

| ID | Invariant | Deps | Modules / files | DB | Migration | Focused tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|-----------------|-----|-----------|---------------|-------------|---------|----------|------|--------|
| **DP1-A-01** | `finance_payment_holds` table with tenant isolation | 04,11 | `apps/api/prisma/schema.prisma`, migration SQL | New table: `id`, `tenant_id`, `registration_id` UNIQUE, `status`, `due_at`, `policy_hours`, `extended_count`, `created_at`, `updated_at`, `satisfied_at`, `expired_at` | Expand-only CREATE | Prisma schema test | — | — | Drop table unused | MEDIUM | `[v]` |
| **DP1-A-02** | `operator_registrations.cancel_source` nullable string | 04 | Same Prisma | Add `cancel_source` VARCHAR nullable | Expand-only ALTER | — | — | — | Column ignored by old app | LOW | `[v]` |
| **DP1-A-03** | Index `(tenant_id, status, due_at)` for worker scan | 04 | Prisma | Index on holds | Same migration | — | — | — | Index drop | LOW | `[v]` |
| **DP1-A-04** | Memory driver parity struct | 04 | `in-memory-bookings.repository.ts`, new `in-memory-payment-holds.ts` | None | — | `payment-hold-memory-parity.spec.ts` | memory API | — | — | HIGH | `[v]` |

**Failing test first (A):** `packages/finance-core/test/payment-hold-repository.contract.spec.ts` — insert open hold, read by registrationId.

---

### DP1-B — policy resolution

| ID | Invariant | Deps | Modules | DB | Migration | Tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|---------|-----|-----------|-------|-------------|---------|----------|------|--------|
| **DP1-B-01** | Resolve hours: tour `pricing.paymentDeadlineHours` → workspace default 24 | 01 | `packages/workspaces/denali/src/finance/resolve-denali-payment-deadline-hours.ts` (new) | TenantConfig optional | — | Unit: tour override, inherit, invalid | — | — | Default 24 hardcoded fallback | LOW | `[ ]` |
| **DP1-B-02** | `dueAt = approvedAt + hours` UTC | 01 | Uses `BookingClockPort` / Finance clock | — | — | Unit DST edge | — | — | — | MEDIUM | `[ ]` |
| **DP1-B-03** | Free/waived tours skip hold creation | 02,11 | Denali approve hook | — | — | `finance-free-collection.spec.ts` extension | approve free tour | — | — | MEDIUM | `[ ]` |

**Failing test first (B):** `packages/workspaces/denali/test/resolve-denali-payment-deadline-hours.spec.ts`.

---

### DP1-C — approval integration

| ID | Invariant | Deps | Modules | DB | Tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|---------|-----|-------|-------------|---------|----------|------|--------|
| **DP1-C-01** | Approve TX creates hold + does not duplicate on re-approve | 01,04,11 | `apps/api/src/bookings/bookings.service.ts`, `create-bookings-service.ts` | hold row | `booking-approve-payment-hold.spec.ts` | `bookings-http-postgres.spec.ts` | BR-OP-01 | Flag `PAYMENT_HOLD_ENABLED=false` | FINANCIAL_HIGH | `[ ]` |
| **DP1-C-02** | Denali auto-approve path same semantics | 01,11 | `packages/workspaces/denali/src/http/registration.service.ts` | same | `registration-auto-approve.spec.ts` extend | API | — | — | HIGH | `[ ]` |
| **DP1-C-03** | `registration.approved` outbox unchanged; add `payment.hold.scheduled` | 04 | `booking-lifecycle-events.ts` extend; outbox payload schema | outbox | outbox golden update | postgres outbox | — | — | MEDIUM | `[ ]` |
| **DP1-C-04** | `cancelSource` set only on expiry cancel | 04 | `cancelBooking` + expiry path | column | unit | integration | — | — | LOW | `[ ]` |

**Failing test first (C):** `apps/api/test/booking-approve-payment-hold.spec.ts` — S1 assertions.

---

### DP1-D — Finance integration

| ID | Invariant | Deps | Modules | DB | Tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|---------|-----|-------|-------------|---------|----------|------|--------|
| **DP1-D-01** | Amend DEC-CQ-001 doc: approve is freeze trigger | 11 | `docs/workspaces/denali/commercial-quote-snapshot.mdoc` | — | doc guard | — | — | doc revert | LOW | `[ ]` |
| **DP1-D-02** | `CommercialQuoteService.ensureFrozenOnApprove` | 11 | `packages/finance-core/src/application/commercial-quote.service.ts` | quotes | `commercial-quote-freeze-on-approve.spec.ts` | finance + booking | — | skip freeze call | FINANCIAL_HIGH | `[ ]` |
| **DP1-D-03** | Approve TX: quote then hold ordering | 11,04 | Host coordinator `approveBookingWithFinanceSideEffects` | both | integration S1 | postgres TX | — | — | FINANCIAL_HIGH | `[ ]` |
| **DP1-D-04** | Invoice remaining uses frozen quote payable | 11 | existing `resolveInvoiceObligationMinor` | — | `outstanding-balances` specs | PAY-FIN-02 | BR-MEM-02 | — | HIGH | `[ ]` |
| **DP1-D-05** | Hold `satisfied` on `remainingMinor=0` | 04 | `PaymentHoldService.satisfy` called from capture path | hold | unit + S2 | finance receipt approve | BR-OP-02 | — | FINANCIAL_HIGH | `[ ]` |

**Failing test first (D):** `packages/finance-core/test/commercial-quote-freeze-on-approve.spec.ts`.

---

### DP1-E — expiry engine

| ID | Invariant | Deps | Modules | DB | Tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|---------|-----|-------|-------------|---------|----------|------|--------|
| **DP1-E-01** | Worker scans `hold.status=open AND due_at<=now` | 01,04 | `apps/api/src/finance/start-payment-hold-expiry-scheduler.ts` (new; pattern `start-denali-exposure-reminder-scheduler.ts`) | — | scheduler unit | S4,S18 | — | `PAYMENT_HOLD_EXPIRY_ENABLED=false` | HIGH | `[ ]` |
| **DP1-E-02** | Expiry calls booking cancel with `payment_deadline` | 04 | `expirePaymentHoldForRegistration` | — | S4 | postgres | BR-OP-03 | — | FINANCIAL_HIGH | `[ ]` |
| **DP1-E-03** | Outbox `payment.hold.expired` | 04 | finance outbox constants | — | golden | relay spec | — | — | MEDIUM | `[ ]` |

**Failing test first (E):** `apps/api/test/payment-hold-expiry.spec.ts` — S4 domain.

---

### DP1-F — race / idempotency

| ID | Invariant | Deps | Modules | Tests | Integration | Browser | Rollback | Risk | Status |
|----|-----------|------|---------|-------|-------------|---------|----------|------|--------|
| **DP1-F-01** | Tour advisory lock wraps expiry + capture | 04 | extend `booking-prisma-approve-concurrency` pattern to finance capture | concurrency spec | S8 | — | — | FINANCIAL_HIGH | `[ ]` |
| **DP1-F-02** | CAS `UPDATE booking SET status=cancelled WHERE status=approved AND id=?` | 04 | bookings repository | unit | S8,S9 | — | — | HIGH | `[ ]` |
| **DP1-F-03** | Idempotent outbox `payment.hold.expired:{holdId}:{expiredAt}` | 04 | outbox repo | S9 | postgres | — | — | MEDIUM | `[ ]` |
| **DP1-F-04** | Duplicate promote guard S20 | 04,02 | `promoteWaitlist` capacity assert | `booking-capacity-correctness` extend | S20 | BR-WL-01 | — | HIGH | `[ ]` |

**Failing test first (F):** `apps/api/test/payment-hold-expiry-race.spec.ts` — S8 deterministic.

---

### DP1-G — capacity / waitlist

| ID | Invariant | Deps | Modules | Tests | Integration | Browser | Risk | Status |
|----|-----------|------|---------|-------|-------------|---------|------|--------|
| **DP1-G-01** | `registrationOccupiesSeat` only `approved` | 02 | `tour-core` — **no code change** | existing CW5-11 | S5 | — | LOW | `[ ]` |
| **DP1-G-02** | Catalog spots after expiry | 02,04 | `filter-denali-catalog-list.ts` | `DN-CAT-05` extend | S5 | marketing optional | MEDIUM | `[ ]` |
| **DP1-G-03** | Auto-promote one waitlist on expiry | 04 | `bookings.service.ts` post-cancel hook | S6,S20 | postgres | BR-WL-01 | HIGH | `[ ]` |

**Failing test first (G):** `packages/workspaces/denali/test/booking-payment-deadline-waitlist.spec.ts` — S6.

---

### DP1-H — Portal

| ID | Invariant | Deps | Modules | Tests | Browser | Risk | Status |
|----|-----------|------|---------|-------|---------|------|--------|
| **DP1-H-01** | GET registration exposes `paymentDueAt`, `holdStatus` | 01,04 | `registration-get.service.ts`, portal BFF | contract | BR-MEM-01 | LOW | `[ ]` |
| **DP1-H-02** | Detail shows countdown while `approved`+`open` | 01 | `apps/portal/app/me/registrations/[id]/` | component | BR-MEM-01 1440+390 | MEDIUM | `[ ]` |
| **DP1-H-03** | Closed `data-closed-reason=payment_expired` | 04 | `member-receipt-upload-form.tsx` | portal spec | BR-MEM-03 | LOW | `[ ]` |
| **DP1-H-04** | Receipt upload blocked when cancelled payment_expired | 04 | same | `SMK-PTL-04` extend | BR-MEM-03 | MEDIUM | `[ ]` |

**Failing test first (H):** `apps/portal/test/portal-payment-deadline.spec.ts`.

---

### DP1-I — Operator

| ID | Invariant | Deps | Modules | Tests | Browser | Risk | Status |
|----|-----------|------|---------|-------|---------|------|--------|
| **DP1-I-01** | Bookings list column `paymentDueAt` | 01,04 | `bookings-command-center-shell.tsx`, list API | web unit | BR-OP-01 1440 | LOW | `[ ]` |
| **DP1-I-02** | Tour workspace finance tab shows dueAt (not conflate departure overdue badge) | 01 | `tour-workspace-finance-client.tsx` | existing + extend | BR-OP-02 | MEDIUM | `[ ]` |
| **DP1-I-03** | Operator extend deadline action | 01 | new API `POST /finance/payment-holds/:id/extend` | S11 | BR-OP-04 | MEDIUM | `[ ]` |
| **DP1-I-04** | Cancelled shows `cancelSource` | 04 | booking detail panel | unit | BR-OP-03 | LOW | `[ ]` |

**Failing test first (I):** `apps/web/test/bookings-payment-deadline.spec.ts`.

---

### DP1-J — notifications / events

| ID | Invariant | Deps | Modules | Tests | Browser | Risk | Status |
|----|-----------|------|---------|-------|---------|------|--------|
| **DP1-J-01** | Emit `payment.hold.scheduled` on approve | 04 | outbox + relay | event spec | — | LOW | `[ ]` |
| **DP1-J-02** | Emit `payment.hold.expired` on expiry | 04 | same | S4 | — | LOW | `[ ]` |
| **DP1-J-03** | Member notification delivery | 12 **deferred** | — | — | — | DP-4 | LOW | `[ ]` DEFER |

**Note:** DP-1 delivers **EVENT_EXISTS** only for new hold events. Portal inbox delivery is **DP-4** (DEN-PROD-12).

---

### DP1-K — migration / backfill

| ID | Invariant | Deps | Modules | Tests | Rollback | Risk | Status |
|----|-----------|------|---------|-------|----------|------|--------|
| **DP1-K-01** | Deploy 1: schema nullable, worker **OFF**, approve creates hold (new regs only) | 01,04 | migration | deploy test | disable feature flag | MEDIUM | `[ ]` |
| **DP1-K-02** | Grandfather: existing approved-unpaid **no hold** = no expiry | 11 | — | S grandfather | — | LOW | `[ ]` |
| **DP1-K-03** | Optional backfill job: `approvedAt+24h` for grandfather (operator opt-in) | 01 | script `scripts/backfill-payment-holds.ts` | dry-run | — | HIGH | `[ ]` OPTIONAL |
| **DP1-K-04** | Deploy 2: enable worker after hold creation stable | 04 | env `PAYMENT_HOLD_EXPIRY_ENABLED=true` | S18 | env off | HIGH | `[ ]` |

---

### DP1-L — automated E2E

| ID | Invariant | Deps | Modules | Tests | Status |
|----|-----------|------|---------|-------|--------|
| **DP1-L-01** | Playwright spec `denali-payment-deadline.spec.ts` | all | `apps/web/tests/e2e/` | S1,S2,S4,S11 | `[ ]` |
| **DP1-L-02** | Portal E2E `portal-payment-deadline.spec.ts` | H | `apps/portal/tests/e2e/` | S1,S4,S16,S17 | `[ ]` |
| **DP1-L-03** | API integration bundle `payment-hold.integration.spec.ts` | all | `apps/api/test/` | S1–S11,S13–S20 | `[ ]` |
| **DP1-L-04** | 20-scenario matrix CI job `pnpm run test:dp1-payment-deadline` | all | `package.json` script | full matrix | `[ ]` |

**Gate:** DP1-L-04 green required for `[v]`; **not** `[x]`.

---

### DP1-M — browser certification

| ID | Invariant | Browser IDs | Status |
|----|-----------|-------------|--------|
| **DP1-M-01** | Operator journeys | BR-OP-01…04 | `[ ]` |
| **DP1-M-02** | Member journeys | BR-MEM-01…03 | `[ ]` |
| **DP1-M-03** | Waitlist journey | BR-WL-01 | `[ ]` |
| **DP1-M-04** | Evidence pack archived | screenshots + HAR + console | `[ ]` |

`[x]` for DP-1 requires DP1-M-04 + DP1-L-04 + product owner sign-off.

---

## DB migration plan

### Phase M1 — expand (deploy before code or with code behind flag)

```sql
-- finance_payment_holds (new)
-- operator_registrations.cancel_source VARCHAR NULL
-- indexes as DP1-A-03
```

- **Grandfather:** rows without hold → never selected by expiry worker.
- **New approves:** create hold when `PAYMENT_HOLD_ENABLED=true`.

### Phase M2 — application enable

1. Ship approve side-effects (hold + quote freeze).
2. Soak with worker **disabled**.
3. Enable `PAYMENT_HOLD_EXPIRY_ENABLED=true`.

### Phase M3 — optional backfill (DP1-K-03)

- Batch create holds for approved-unpaid with `dueAt = greatest(now, approvedAt+24h)` or immediate expiry if past — **product chose grandfather default = no backfill in M1**.

### Coexistence

- Old app versions: ignore unknown columns; do not run worker.
- New app: dual-read `dueAt` from hold API; missing hold → UI shows “—”.

### Rollback

1. Set `PAYMENT_HOLD_ENABLED=false` and `PAYMENT_HOLD_EXPIRY_ENABLED=false`.
2. Approve reverts to legacy (no hold) — **acceptable** only before holds exist in prod.
3. If holds exist: **do not** roll back schema; forward-fix only.
4. Worker off stops new expiries; manual ops for stuck approved-unpaid.

---

## Race / idempotency strategy

| Mechanism | Use |
|-----------|-----|
| Tour-scoped **Postgres advisory lock** | Serialize approve, capture, expiry, promote for same `tourId` |
| **Re-read** `remainingMinor` inside lock | Payment vs expiry winner |
| **CAS** status transitions | `approved→cancelled`, hold `open→expired` |
| **Outbox idempotency** | `(tenant_id, domain_event_id)` unique |
| **Promote** | Capacity assert inside same lock; S20 single consume |
| **Clock** | Finance `FinanceClockPort.now()` in worker; store UTC |
| **No** `reactAfterApprove` for hold/quote | Durable approve TX only |

---

## Automated coverage map

| Scenario | Primary spec file |
|----------|-------------------|
| S1 | `booking-approve-payment-hold.spec.ts` |
| S2 | `finance-receipt-approve-gate.spec.ts` + hold satisfy |
| S3/S8 | `payment-hold-expiry-race.spec.ts` |
| S4,S5 | `payment-hold-expiry.spec.ts` |
| S6,S7,S20 | `booking-payment-deadline-waitlist.spec.ts` |
| S9 | `payment-hold-expiry-idempotency.spec.ts` |
| S10,S10b | `finance-manual-debt` + expiry |
| S11 | `payment-hold-extend.spec.ts` |
| S13 | `booking-lifecycle.spec.ts` |
| S14 | `payment-hold-policy-immutable.spec.ts` |
| S15–S17 | `portal-payment-deadline.spec.ts` |
| S18,S19 | `payment-hold-scheduler.spec.ts` |

---

## Browser coverage map

### BR-OP-01 — Operator approve sees deadline

| Field | Value |
|-------|-------|
| **Role** | Operator owner |
| **Setup** | Tour capacity 10, pending registration, paid tour |
| **URL** | `http://denali.admin.localhost:3000/bookings` |
| **Actions** | Approve pending row |
| **Visible** | Status Approved; Payment Unpaid; Due column ~24h |
| **Network** | `POST .../bookings/{id}/approve` 200; response includes `paymentDueAt` |
| **Domain** | hold `open`; quote v1; R=approved P=unpaid |
| **Evidence** | screenshot + HAR + console clean |

### BR-OP-02 — Pay before deadline

| Field | Value |
|-------|-------|
| **URL** | `/finance?tab=receipts` or tour workspace finance tab |
| **Actions** | Member uploads receipt (BR-MEM-02); operator approves receipt |
| **Visible** | Paid; due countdown gone |
| **Network** | receipt approve 200 |
| **Domain** | hold satisfied; P=paid |

### BR-OP-03 — Expiry cancel

| Field | Value |
|-------|-------|
| **Setup** | Hold `dueAt` in past (test clock or seed) |
| **Actions** | Run worker or wait scheduler tick |
| **Visible** | Registration cancelled; reason payment deadline |
| **Network** | cancel + hold expired events |
| **Domain** | R=cancelled cancelSource=payment_deadline; Occ=no |

### BR-OP-04 — Extend deadline

| Field | Value |
|-------|-------|
| **Actions** | Extend +24h on approved unpaid |
| **Visible** | New dueAt |
| **Network** | `POST .../payment-holds/.../extend` 200 |

### BR-MEM-01 — Member sees dueAt (desktop + mobile)

| Field | Value |
|-------|-------|
| **Role** | Member |
| **URL** | `http://denali.portal.localhost:3003/me/registrations/{id}` |
| **Viewport** | 1440 and 390 |
| **Visible** | Accepted; amount due; countdown; upload enabled |
| **Network** | GET registration includes same `paymentDueAt` as operator |

### BR-MEM-02 — Member pays in time

Same as BR-OP-02 from portal receipt upload flow.

### BR-MEM-03 — Expired closed state

| Field | Value |
|-------|-------|
| **Visible** | `data-closed-reason=payment_expired`; no file input |
| **Copy** | Payment deadline missed (i18n key `portalMember.paymentExpiredTitle`) |

### BR-WL-01 — Waitlist promote on expiry

| Field | Value |
|-------|-------|
| **Roles** | Member A approved (expires), Member B waitlisted |
| **URL** | Operator `/tours/{id}/workspace/waitlist` + bookings |
| **Actions** | Expire A |
| **Visible** | B moves to approved with new dueAt; capacity still full |
| **Domain** | S6 |

---

## Rollback plan

| Stage | Action |
|-------|--------|
| Pre-prod holds | Feature flags off; revert deploy |
| Prod holds, no worker | Worker flag off; manual chase |
| Prod expiries started | **Forward only**; disable worker; ops manual cancel |
| Bad quote freeze | Stop approve hook; finance support uses override path (existing) |

---

## Execution order

```text
1. DP1-A-01…04 + DP1-A tests (schema contract)
2. DP1-B tests + resolver
3. DP1-D-01 doc amend + DP1-D-02 quote freeze tests
4. DP1-C tests (approve creates hold+quote) — FAILING FIRST
5. DP1-D-03 approve TX wiring
6. DP1-H/I read APIs (dueAt projection)
7. DP1-E + DP1-F tests (expiry + race)
8. DP1-G waitlist tests
9. DP1-K-01 deploy M1 (flags off worker)
10. Enable approve flag → soak
11. DP1-K-04 enable worker
12. DP1-L E2E
13. DP1-M browser certification → [x]
```

**Strangler rule:** do not enable worker between M1 deploy and approve-hook deploy without flags.

---

## First implementation slice

**TEST-FIRST ONLY — next PR scope:**

1. **DP1-A-01** migration file + Prisma model (no runtime wire).
2. **DP1-B-01** + `resolve-denali-payment-deadline-hours.spec.ts` (**failing**).
3. **DP1-D-02** + `commercial-quote-freeze-on-approve.spec.ts` (**failing**).
4. **DP1-C** + `booking-approve-payment-hold.spec.ts` (**failing**) asserting S1 domain outcomes.
5. **DP1-D-01** doc amend DEC-CQ-001 (required by doc-first covenant before `apps/api` approve hook lands).

**Do not implement:** expiry worker, portal UI, operator extend, waitlist auto-promote, browser cert — until S1 integration green.

---

## DPR remediation closure (2026-08-24)

Physical red-team + forensic audits surfaced defects remediated on branch `cursor/dp-final-cert-cd75`:

| DPR | Finding | Fix | Regression |
|-----|---------|-----|------------|
| DPR-001 | `ensureFrozenOnApprove` missing at runtime (stale `finance-core` dist) | Rebuild `@app-tour/finance-core`; reset quote cache in DP-1 harness | `scripts/test-dp1-payment-deadline.sh` — 25/25 API |
| DPR-002 | `resolvePolicyHours()` ignored tour canonical | `resolvePaymentHoldPolicyHoursForBooking()` loads tour + `resolveDenaliPaymentDeadlineHours` | DP1-B unit + approve integration |
| DPR-003 | `autoApprovePublicBooking` skipped payment hold | Mirror `approveBooking` hold + free-collection hooks | `booking-public-auto-approve.spec.ts` |
| DPR-004 | Expiry scheduler not bootstrapped | `startPaymentHoldExpiryScheduler()` in `main.ts` warm path | DP1-E scheduler specs |
| DPR-005 | DP-1 gate script exit 0 on failure | `exit "$FAILED"` in `test-dp1-payment-deadline.sh` | Script itself |
| DPR-006 | Import boundary violation (deep denali src import) | Export deadline resolver via `@app-tour/workspace-denali/host/finance` | `guard:import-boundary` |

**Policy resolution flow (post-fix):**

```text
approveBooking / autoApprovePublicBooking
  → ensureFrozenCommercialQuoteOnApprove (finance-core)
  → resolvePaymentHoldPolicyHoursForBooking(tour canonical)
  → scheduleOnApprove(dueAt = approvedAt + policyHours)
  → setBookingPaymentDueAtProjection
```

**Scheduler:** when `PAYMENT_HOLD_ENABLED=true` and `PAYMENT_HOLD_EXPIRY_ENABLED=true`, API warm boot starts 60s expiry tick (memory driver).

---

## Verdict

**DP-1 AUTOMATED_CERTIFIED** (25/25 scenarios, `scripts/test-dp1-payment-deadline.sh` green on 2026-08-24)

Browser/runtime certification tracked separately in master ledger (`DP1-20`, `DP2-11/12`, `DP3-13`).

Architect, documentation status: **Updated**. Link to docs: `docs/dev/dp-1-execution-plan.md`.
