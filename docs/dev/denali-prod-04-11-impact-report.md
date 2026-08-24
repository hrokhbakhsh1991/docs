# DEN-PROD-04 / 11 IMPACT REPORT

```yaml
report_id: DEN-PROD-04-11-IMPACT-2026-08-24
mode: READ_ONLY
authority_plan: docs/dev/denali-product-completion-plan.md
authority_audit: docs/dev/denali-product-completeness-audit.md
cq_lock: docs/workspaces/denali/commercial-quote-snapshot.mdoc
cw_divergence: docs/dev/cw4-05-registration-model-divergence-contract.md
production_code_changed: NO
tests_changed: NO
db_changed: NO
commit: NO
push: NO
verdict: READY_FOR_PRODUCT_DECISION
```

Cursor does **not** close DEN-PROD-04 / 11. This report recommends a combination for product owner sign-off.

**Urban is out of scope for both decisions.** Dual persistence (DEC-CW-01 Option B) stays. No `approved↔confirmed` or `waitlisted↔waitlist` merge.

---

## Current truth

### Booking / registration

| Fact | Evidence |
|------|----------|
| Status vocabulary | `pending \| approved \| waitlisted \| rejected \| cancelled` — `packages/booking-http-contracts/src/booking-status.ts` |
| Transitions | `approved → cancelled` **only** outbound — `booking-lifecycle-transitions.ts` |
| Seat occupancy | `registrationOccupiesSeat` iff `status === "approved"` (booking) or `"confirmed"` (Urban) — `packages/tour-core/src/registration/registration-model.contract.ts` |
| Waitlist | Queued without seat: booking `waitlisted`; Urban `waitlist` |
| Void | `registrationVoided` iff `cancelled` (both models) |
| Persistence | Booking: `operator_registrations` (`status`, `paymentStatus`, `approvedAt`, `registrationIntake`, `rejectReason`). **No `paymentDueAt`.** |
| Approve concurrency | Tour-scoped **advisory lock**, not `FOR UPDATE` — `booking-prisma-approve-concurrency.spec.ts` |
| Outbox | `registration.approved` (durable), `registration.waitlisted`, `registration.cancelled`; **reject silent** |
| Approve reaction | `reactAfterApprove` **not durable**; Denali `eventReaction.mode=none` |
| Member display | Neutral map: `pending_review \| accepted \| waitlisted \| rejected \| cancelled` — DEC-CW-04. Portal closed panel: `data-closed-reason` = `cancelled` \| `rejected` only |
| Operator desk | Bookings CC pipeline from `BOOKING_STATUS_PIPELINE`; transport roster = `status=approved` |
| Capacity | Catalog spots = `capacityMax − Σ approved.partySize` |

### Finance

| Fact | Evidence |
|------|----------|
| Obligation | Lazy `FinanceObligationPort.resolveRegistrationObligation` from tour canonical + intake — `resolve-denali-registration-obligation.ts` |
| Commercial Quote | **Finance-owned**, table `finance_commercial_quotes`, immutable versions, one active until LOCKED — Prisma `FinanceCommercialQuote`; `commercial-quote-snapshot.mdoc` **LOCKED** |
| Freeze trigger (DEC-CQ-001 / CQ-008) | **First money path**, not booking lifecycle, not page views — `ensureQuoteFrozenForMoneyPath` |
| Explicit non-trigger | “Booking lifecycle transitions without a money path” |
| Invoice | Compile from quote payable if present, else preview, else live obligation — `resolveInvoiceObligationMinor` |
| Payment statuses | `unpaid \| partial \| paid` on booking projection |
| Refund | Separate `finance_refunds` aggregate; cancel does **not** auto-refund |
| Member discount | Applied at **freeze** from Identity facts; later membership change does **not** retro-edit quotes (DEC-CQ-002) |
| Intake after approve | Member PATCH intake **forbidden** (`DN-READ-05`) — transport snapshot stable from member side after approve |

### Urban / synthetic

| Workspace | Model | Effect of booking-status change |
|-----------|--------|---------------------------------|
| Urban | `urban_registrations`, `confirmed/waitlist/cancelled` | **None** if DP-1 stays on `bookingPipeline` only |
| cert-club / guest-club | Own HTTP catalog/registration prefixes; not Denali booking desk | **Do not** extend booking enum “for completeness” |
| Harbor | Not on Denali booking pipeline for this decision | **None** |

---

## DEN-PROD-04 option matrix

### A. Reuse registration `cancelled`

| Dimension | Impact |
|-----------|--------|
| **DB** | No new booking status. Optional: `cancelReason` / `cancelSource` (`non_payment`) — `rejectReason` exists for reject only today |
| **State machine** | **No new edge.** Use existing `approved → cancelled` |
| **API contract** | None for status enum. Additive optional reason on cancel payload |
| **Portal** | Already treats `cancelled` as closed. Copy is generic cancel — **must** add `data-closed-reason=payment_expired` (today only cancelled/rejected) |
| **Operator UI** | Appears in cancelled bucket; unpaid expiry looks like any cancel unless reason column |
| **Finance** | Cancelled drops occupancy; outstanding-balance candidates must exclude cancelled (verify PAY-FIN-02 scan). Unpaid expiry: typically **no refund**. Paid+partial: DP-6 |
| **Outbox** | Reuse `registration.cancelled` (at-least-once relay). Downstream cannot distinguish non-payment vs operator cancel without payload field |
| **Notifications** | No dedicated expired template; would share cancel or add payload discriminator |
| **Roster** | Transport tab filters `approved` — expired guests **disappear** (correct if seat released) |
| **Waitlist** | Seat free → existing promote path can run (DEN-PROD-04 promote yes/no still unsigned) |
| **CW / Urban** | `registrationVoided` already `cancelled`. Urban untouched |
| **Compatibility** | Highest. CW4-05 vocabulary unchanged |
| **Migration** | None for status. Grandfather approved-unpaid: no dueAt = never auto-cancel |
| **Rollback** | Disable worker; leftover cancelled rows stay cancelled (honest) |
| **Race** | Same as cancel-vs-capture (see race section) |
| **Risk** | **MEDIUM** — semantic overload of “cancelled”; **LOW** contract risk |

**Ambiguity:** Member/operator cannot tell “I cancelled” vs “deadline missed” without new reason/copy.

---

### B. Add registration state `payment_expired`

| Dimension | Impact |
|-----------|--------|
| **DB** | `status` string already unconstrained in Prisma; **contract** vocabulary must grow |
| **State machine** | New status + edges: `approved → payment_expired`; terminal? If non-terminal, more edges. `BOOKING_TERMINAL_STATUSES` today = rejected, cancelled |
| **API** | `BookingStatus` union, list `?status=` parser, ops manifest pipeline, filters, KPI cards |
| **CW4-05** | `BOOKING_REGISTRATION_MODEL.vocabulary` changes. Need new predicate: voided? occupies seat? (must be **false**). Neutral display enum (DEC-CW-04) has **no** `payment_expired` — extend or map to `cancelled` (then why new status?) |
| **Portal** | New native status; codegen display map; closed-reason; receipt gate |
| **Operator** | New column/bucket; tour board columns today `pending/approved/waitlist/rejected` — add expired |
| **Finance** | Must **not** treat as approved for AR if seat released. Outstanding scan filters |
| **Outbox** | New event type **or** overload cancelled (defeating the status) |
| **Waitlist** | Occupancy: must **not** occupy. Promote from waitlist unchanged once seat free |
| **Urban** | **Must not** add `payment_expired` to Urban vocabulary. Isolation holds **only if** change is booking-pipeline-only |
| **cert-club / guest-club** | No booking status import required; do not “align” them |
| **Migration** | No row rewrite if unused; all consumers of status switches need default branches |
| **Rollback** | Hard: status values in DB; old app builds may 400 on unknown status |
| **Race** | Extra state vs paymentStatus=`paid` (approved vs expired vs paid) — more illegal combinations |
| **Risk** | **HIGH** — platform contract blast for one Denali policy; rollback poor |

**Verdict:** Cleanest English label, **worst** compatibility. Only justified if product refuses to call non-payment “cancelled” **and** will fund DEC-CW-04 + booking-http-contracts + all UIs.

---

### C. Keep `approved` + payment-hold-expired flag/fields

| Dimension | Impact |
|-----------|--------|
| **DB** | New columns on `operator_registrations` or JSON intake: `paymentHoldExpiredAt`, etc. |
| **State machine** | Booking table **unchanged**; occupancy **must change** or seats never release |
| **Capacity trap** | Today occupy = `status === approved`. If they stay `approved`, **spots stay consumed**. C **without** occupancy-formula change **fails DEN-PROD-04 release**. C **with** occupy = `approved AND NOT holdExpired` **changes** `registrationOccupiesSeat` / catalog math — same capacity blast as a new status, hidden in a flag |
| **API** | Additive fields; list filters need `holdExpired` |
| **Portal** | Display map still `accepted` for `approved` — **wrong** unless Portal reads the flag |
| **Operator roster** | Transport tab is `status=approved` — expired guests **remain on day-of roster** unless query changes |
| **Finance** | AR still sees approved+unpaid unless outstanding filter knows the flag |
| **Waitlist** | Promote may fail capacity while “expired-but-approved” hold seats |
| **CW** | Predicate `registrationOccupiesSeat` no longer status-only — **contract change** |
| **Urban** | Safe if predicate change is booking-model-only |
| **Migration** | Nullable flags; backfill false |
| **Rollback** | Easier than B if occupancy change is flagged |
| **Race** | Flag flip vs paymentStatus=paid: can be `approved+paid+expired` unless CAS |
| **Risk** | **HIGH** if occupancy unchanged (product lie). **HIGH** if occupancy changed (hidden contract change). Semantic: “approved but not coming” |

**Verdict:** Do **not** keep `approved` as occupancy-true after unpaid expiry.

---

### D. Separate payment-hold lifecycle object

| Dimension | Impact |
|-----------|--------|
| **DB** | New Finance (recommended) or Booking-adjacent table: `registration_id`, `tenant_id`, `due_at`, `status` (`open\|satisfied\|expired\|extended`), `expired_at`, `row_version` / idempotency. **Not** a new booking status |
| **State machine** | Hold machine **plus** a **booking consequence** on expiry (see combination) |
| **API** | New finance/booking hold resource **or** fields on GET booking/invoice |
| **Portal** | Read `dueAt` + hold status; lifecycle still booking status |
| **Operator** | Countdown from hold; desk stays dual-axis (already taught) |
| **Finance** | Natural owner next to quote/invoice clock; do **not** reuse installment `finance_schedules.dueAt` (installments **off**, different meaning) |
| **Outbox** | `payment.hold.scheduled` / `payment.hold.expired` (Finance) then Bookings emits `registration.cancelled` if consequence is A |
| **Capacity** | Occupancy stays status-based **if** expiry **cancels** booking (A). Hold object does not occupy seats |
| **Waitlist** | After booking cancel, existing promote |
| **CW / Urban** | No vocabulary change. Urban never gets a hold table unless they opt in later |
| **Migration** | New table, nullable, worker off until backfill policy |
| **Rollback** | Drop unused table / disable worker; no poisoned booking statuses |
| **Race** | Hold `open → satisfied|expired` CAS + booking cancel in **same tour advisory lock** as capture |
| **Risk** | **MEDIUM** — new aggregate, but matches existing dual-axis (Bookings lifecycle × Finance money) |

**Verdict:** Best **SoT for the clock**. Incomplete alone: must define booking consequence (recommend A).

---

### E. Other evidence-backed option

**E1. Operator-review queue without auto-transition** — hold expires, booking stays approved, ops must click. **Does not** fix capacity leak (audit P0). Reject for MINIMUM PAID OPERATIONS.

**E2. `rejected` + reason `non_payment`** — `approved → rejected` is **illegal** today. Worse than cancelled (silent outbox, “terminal negative” predicate). Reject.

---

## Payment-expiry race analysis

Applies to every viable model. **Exactly one** of: (payment captured + seat kept) **or** (expiry wins + seat released + no new capture).

### Timeline T1 → T2 → T3

```text
T1  Expiry worker selects due hold (open, dueAt <= now, booking.approved, remaining > 0)
T2  Finance capture/receipt-approve sets paid (or remaining = 0)
T3  Expiry commits cancel / expire
```

**Required winner rule (recommend for product sign-off, not invented money policy):**  
If invoice `remainingMinor = 0` (or `paymentStatus = paid` / waived) at lock time → **expiry no-op**.  
If remaining > 0 and status still `approved` → **expiry proceeds**; subsequent capture must fail closed (`FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING` already blocks non-approved).

### Mechanisms (evaluate)

| Mechanism | Fit |
|-----------|-----|
| **Tour advisory lock** | **Use.** Already serializes approve vs occupancy. Expiry **and** money-path capture for that tour must take the **same lock** before re-read. Today receipt-approve may **not** share this lock — **gap to close in DP-1**, not a new product status |
| **Compare-and-set** | **Use.** Booking: `UPDATE … WHERE id=? AND status='approved' AND payment_status IN ('unpaid','partial')`. Hold: `open → expired` only if `status=open`. 0 rows = no-op |
| **Optimistic rowVersion** | Booking row has no `rowVersion` on `OperatorRegistration` today (tours do). Optional later; CAS on status is enough for v1 |
| **Idempotency key** | Payments already have `creationIdempotencyKey`. Expiry: `domain_event_id` unique `(tenant_id, domain_event_id)` like approve outbox |
| **Finance payment-finalization check** | **Mandatory re-read** of invoice remaining **inside** lock after T2. Do not trust the T1 select list |
| **Expiry event idempotency** | Outbox at-most-once insert; relay at-least-once → consumers must be idempotent (already documented for approve) |

### Other hazards

| Hazard | Handling |
|--------|----------|
| **Delayed worker** | Re-check remaining + status; paid registrations skipped (scenario 19) |
| **Duplicate expiry job** | CAS 0 rows; unique outbox insert |
| **Process restart** | Durable hold `dueAt` + worker poll (pattern: exposure reminder scheduler). In-process `reactAfterApprove` **must not** own expiry |
| **Clock skew** | Persist `dueAt` UTC ISO; worker uses **Finance clock port** or DB `now()` consistently; no local TZ math. DST = display only |
| **Partial payment** | If remaining > 0, treat as unpaid for expiry **unless** product later carves exception (DP-1 S10). Do not invent “partial stops expiry” |
| **Free/waived** | `applyFreeCollectionPayment` on approve → paid/waived → **no hold** or hold `satisfied` immediately |

---

## DEN-PROD-11 option matrix

### A. Materialize immutable obligation on approval

| Dimension | Impact |
|-----------|--------|
| **Meaning** | Writable payable snapshot at approve time |
| **Finance architecture** | **Conflicts with locked DEC-CQ-001** (“booking lifecycle without money path” is a **non-trigger**). Would be an **amendment**, not a greenfield table |
| **Native path** | If done, **must** be `CommercialQuoteService.ensureFrozenForMoneyPath` **also called from approve** (or new `ensureFrozenOnApprove`) writing `finance_commercial_quotes` — **not** a second obligation table |
| **Duplicate obligation** | Two stores (lazy resolve + quote + new row) = **forbidden**. One SoT = quote payable |
| **DB** | No new table if using quotes; approve path writes first quote version |
| **Intake** | Already frozen for member after approve — freeze-at-approve matches member-side freeze |
| **Tour price later** | Would **not** change payable (desired for audit; needs DEN-PROD-10) |
| **Membership later** | DEC-CQ-002: does not retro-edit quotes — freeze-at-approve **locks discount then** |
| **Partial/refund** | Unchanged once LOCKED on first capture |
| **Portal/operator due** | Invoice uses quote payable immediately — no live drift |
| **Risk** | **MEDIUM** — contract amendment; **LOW** schema if reuse quotes |

---

### B. Keep lazy obligation + persist due metadata elsewhere

| Dimension | Impact |
|-----------|--------|
| **Meaning** | Amount still live until money-path freeze; clock stored on hold (04-D) or booking column |
| **Finance** | **Compatible** with locked CQ. Display uses `resolveCommercialQuotePreview` / live obligation (already) |
| **Price after approve before receipt** | **Member owes live tour+intake** until first money path — **audit gap** while they hold a seat |
| **DB** | `dueAt` on hold or `operator_registrations.payment_due_at` |
| **Risk** | **LOW** migration; **HIGH** commercial drift if operators edit tour price (DEN-PROD-10 unsigned) |

---

### C. Immutable quote on approval, obligation when payment begins

| Dimension | Impact |
|-----------|--------|
| **Meaning** | Split “quote” vs “obligation” in time |
| **Finance native** | Quote **is** the payable obligation input (`resolveInvoiceObligationMinor` prefers quote). A second “obligation at payment start” **duplicates** CQ and risks mismatch |
| **Risk** | **HIGH** semantic duplication. Not how `finance-core` works today |

---

### D. Existing Finance-native model (money-path freeze)

| Dimension | Impact |
|-----------|--------|
| **Meaning** | Status quo CQ: freeze on receipt/manual payment/override money path; lock on first capture |
| **DB** | `finance_commercial_quotes` **already exists** |
| **Invariants** | Version/supersede/lock already tested |
| **Gap** | Clock (`dueAt`) is **not** a quote field; do not overload quote for deadlines |
| **Risk** | **LOW** for amounts; **does not** solve expiry by itself |

---

## Pricing / obligation immutability analysis

Answers from **current code + locked CQ**, not new policy.

| Change after approval | Before quote freeze (money path) | After freeze, before LOCKED | After first capture (LOCKED) |
|----------------------|----------------------------------|-----------------------------|------------------------------|
| **Tour list price** | Live obligation **changes** (lazy) | New quote version **if** money path rebuilds input and fields differ; tour edit does **not** auto-supersede | **No** reprice; refund/credit only |
| **Membership %** | Preview may change | DEC-CQ-002: membership change does **not** retro; new freeze input might still apply if freeze runs again with new Identity facts — **need DP-1 to pin freeze-once-at-approve or freeze-once-at-first-money** | **No** |
| **Transport / intake** | Member **cannot** amend (`DN-READ-05`). Operator/tour transport canonical **can** still change live gross | Same as tour price | **No** |
| **Operator override** | Override API may persist before freeze | New version, `source=operator_override` | **Forbidden** |

**What must be immutable for audit (Finance already states):**

- Quote **versions** never mutate (supersede).
- Ledger payments/refunds never rewrite.
- After LOCKED: payable history + captures + refunds.

**What is not immutable today:** tour canonical price while quote unfrozen; that is the DEN-PROD-11 hole during approved-unpaid.

---

## Recommended combination

### DEN-PROD-04: **D (Payment Hold) + A (booking consequence = `cancelled`)**

**Not C. Not B unless product funds a full booking-contract program.**

#### Exact semantics

1. On approve (paid/waived excepted): create **Payment Hold** `open` with `dueAt = approvedAt + policy`.
2. Occupancy remains **`status === approved` only**.
3. On successful capture (remaining = 0): hold → `satisfied`; booking stays `approved`.
4. On expiry win: hold → `expired`; booking **`approved → cancelled`** with **`cancelSource = payment_deadline`** (additive field; not a new status).
5. Portal: `cancelled` + `data-closed-reason=payment_expired`.
6. Waitlist promote: **optional second step** after cancel (still DEN-PROD-04 promote flag); use existing promote + advisory lock.
7. Urban: **no changes**.

#### Persistence

- **Hold:** new Finance table (preferred) `finance_payment_holds` keyed by `(tenant_id, registration_id)` unique open row.
- **Do not** use `finance_schedules.dueAt`.
- **Booking:** existing `status`; additive `cancelSource` (nullable).

#### Ownership

| Object | Owner |
|--------|-------|
| Policy hours | Denali tour/workspace canonical |
| `dueAt` + hold status | **Finance** |
| Seat release / `cancelled` | **Bookings** (called by expiry TX coordinator in API host) |
| Promote | **Bookings** |
| Display | Portal/web read hold + booking |

#### Events

- Finance: `payment.hold.expired` (durable).
- Bookings: `registration.cancelled` with payload `source=payment_deadline`.
- Do **not** rely on `reactAfterApprove` for expiry.

#### Capacity / Finance / Portal / operator

- Capacity: cancel → voided → spots free (existing predicates).
- Finance: unpaid cancel → no refund; outstanding excludes cancelled.
- Portal: closed + expired copy; no receipt upload (`cancelled` already forbidden).
- Operator: cancelled + reason; countdown while `open`.

#### Migration / rollback / risk

- Nullable hold rows; grandfather no hold = no auto-expiry.
- Rollback: stop worker; holds unused; no illegal statuses.
- Risk: **MEDIUM**. Copy work for “cancelled means expired”.

---

### DEN-PROD-11: **D (native CQ) + freeze-on-approve amendment + dueAt on hold (B for clock only)**

#### Exact semantics

- **Payable SoT** remains `finance_commercial_quotes` (not a new obligation entity).
- **Amend DEC-CQ-001:** add **approve** (and auto-approve) as a freeze trigger **in addition to** money path — because approve is when the **seat is granted** and member intake is already frozen.
- **Do not** freeze on pending create (rejected CQ Option A).
- **Clock** lives on Payment Hold, not on quote.
- After freeze: tour price / membership / transport canonical changes **do not** change what the member owes.
- First capture: existing LOCKED behavior.
- Money path after approve: `ensureFrozenForMoneyPath` matches active quote (no-op) or supersede only for **allowed** pre-lock overrides (operator override).

This is **not** user Option C (split quote vs obligation). Invoice already uses quote payable.

#### Persistence / ownership / events

- Quotes table existing; write version on approve in same host TX **after** booking approve commits **or** in durable outbox consumer that **is** replay-safe (prefer **in approve TX** with quote insert — outbox reaction is not durable enough).
- Hold created same TX.
- Events: none required for quote beyond existing finance; hold scheduled event optional.

#### Amount questions (recommended answers for sign-off)

| Question | Answer under this combo |
|----------|-------------------------|
| Tour price changes after approval | **No** — frozen quote |
| Membership changes | **No** — frozen at approve |
| Transport choice changes | Member **cannot**; if operator mutates tour transport, **no** reprice (DEN-PROD-10 may later allow override version) |
| Existing approved reprice? | **No** automatically |
| Audit immutable | Quote version + later payments/refunds |

#### Migration / rollback / risk

- Existing approved-unpaid: no quote until money path (legacy) **or** backfill freeze job — product must pick grandfather.
- Rollback: stop calling freeze on approve; old quotes remain valid versions.
- Risk: **MEDIUM** (CQ contract amend) vs **LOW** schema.
- **If product refuses to amend DEC-CQ-001:** fall back to **11-B+D** (lazy until money path) and accept live reprice until first receipt — **weaker audit**, **lower** contract risk. State that explicitly in the sign-off.

---

## Rejected options

| Option | Why |
|--------|-----|
| 04-B `payment_expired` status | Explodes `booking-http-contracts`, DEC-CW-04 display enum, ops manifests, filters, rollback. Urban isolation is possible but expensive. Label can be UX on cancelled+reason |
| 04-C stay `approved` | Occupancy trap **or** hidden occupancy-contract change; roster/Portal still “accepted” |
| 04-E1 review-only expiry | Does not release seats |
| 04-E2 `rejected` | Illegal transition; silent outbox |
| 11-C quote vs obligation split | Duplicates CQ; invoice already = quote payable |
| 11-A as a **second** obligation table | Duplicate SoT vs quotes |
| Forcing Urban / cert-club / guest-club onto booking hold | DEC-CW-01 violation |

---

## Required decisions (product owner)

Still **unsigned** — this report **recommends**, does not close:

1. **DEN-PROD-04 representation:** Accept **D+A** vs insist on **B** (budget contract change) vs **C** (rejected here).
2. **DEN-PROD-04 promote:** Auto-promote waitlist after expiry cancel? Yes/No.
3. **Partial-before-deadline:** Expiry if `remaining > 0`? Recommend **Yes**.
4. **DEN-PROD-11:** Amend DEC-CQ-001 freeze-on-approve vs keep money-path-only (live price until receipt).
5. **Grandfather:** Existing approved-unpaid: no expiry vs backfill dueAt vs freeze quotes now.
6. **Cancel copy:** Confirm “cancelled + reason payment_deadline” is legally acceptable vs paid-ops requiring a distinct status (if distinct → 04-B and a **new program increment**).

DEN-PROD-01 (duration) and DEN-PROD-02 (hold seats on approve) remain blocking for DP-1 but are **out of this report’s resolution scope**.

---

## DP-1 implementation blast radius (if D+A + CQ freeze-on-approve)

Likely touch — **not an implementation list:**

| Layer | Modules / packages / tables |
|-------|------------------------------|
| Contracts | `packages/booking-http-contracts` (cancel payload/source only, **not** new status if D+A); `docs/workspaces/denali/commercial-quote-snapshot.mdoc` (DEC-CQ-001 amend); `docs/workspaces/denali/registration-payment-orchestration.mdoc` |
| Bookings | `apps/api/src/bookings/bookings.service.ts`, `create-bookings-service.ts`, Prisma + memory repos, `cancelBooking`, advisory lock usage on capture |
| Finance | `packages/finance-core` (hold service **new**; `CommercialQuoteService` call from approve); `apps/api/src/workspace-finance/*`; Prisma `finance_payment_holds` **new**; `finance_commercial_quotes` writes on approve |
| Denali | `packages/workspaces/denali/src/booking/*`, `src/finance/*`, registration auto-approve path |
| Host scheduler | `apps/api/src` new expiry poller (pattern `start-denali-exposure-reminder-scheduler.ts`); outbox relay |
| Portal | `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx` (`data-closed-reason`); dueAt display; i18n |
| Operator | `apps/web/src/features/bookings/*`, `tour-workspace-finance-*`, overdue badge **must not** reuse departure 48h badge |
| Tests | Denali booking-domain, finance-core CQ, api bookings concurrency, portal MEM/SMK-PTL, **new** 20-scenario matrix |
| Urban / cert-club / guest-club | **No** required changes |

---

## Verdict

**READY_FOR_PRODUCT_DECISION**

Evidence is sufficient. Remaining work is **sign-off**, not more code archaeology.

Recommended pair for sign-off:

```text
DEN-PROD-04 = Payment Hold (Finance) + approved→cancelled (source=payment_deadline)
DEN-PROD-11 = Existing Commercial Quote as payable SoT
             + freeze on approve (amend DEC-CQ-001)
             + dueAt on Hold (not on quote, not lazy amount)
```

Architect, documentation status: **Updated**. Link to docs: `docs/dev/denali-prod-04-11-impact-report.md`.
