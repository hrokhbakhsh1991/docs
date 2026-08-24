# DENALI PRODUCT COMPLETION MASTER PLAN

```yaml
plan_id: DENALI-PRODUCT-COMPLETION-2026-08-24
program: Denali Product Completion (DP)
mode: PLANNING_ONLY — no product behavior change in this run
authority_audit: docs/dev/denali-product-completeness-audit.md
status: READY_FOR_PRODUCT_DECISIONS
production_code_changed: NO
tests_changed: NO
db_changed: NO
commit: NO
push: NO
```

This is the **canonical execution ledger** for making Denali operationally complete for a real paying club.

It is **not** an architecture refactor, enterprise-maturity program, or capability extraction.

---

## Status markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | NOT STARTED |
| `[v]` | IMPLEMENTED / AUTOMATED VERIFIED / RUNTIME CLOSURE PENDING |
| `[x]` | COMPLETE — INCLUDING PHYSICAL BROWSER CERTIFICATION |
| `[!]` | BLOCKED / PRODUCT DECISION REQUIRED |

**Hard rule:** product-facing tasks **never** become `[x]` from unit/integration tests alone. `[x]` requires **automated certification + real browser/runtime certification** with UI + network/domain evidence.

---

## Program principle

```text
PRODUCT DECISION
→ CURRENT-BEHAVIOR FREEZE
→ SCENARIO MATRIX
→ AUTOMATED TEST COVERAGE
→ IMPLEMENTATION
→ REGRESSION CERTIFICATION
→ REAL BROWSER TEST
→ SCREENSHOT / NETWORK / CONSOLE EVIDENCE
→ PHASE CLOSURE
```

Never: implementation → invent expected behavior afterward.

Cursor **must not infer unresolved product semantics**. Unresolved gates stay `[!]`.

---

## Executive summary

Denali is **PILOT_READY_WITH_GAPS** (audit 2026-08-24). Core club ops exist: wizard, publish, catalog, OTP registration, operator approve/waitlist/reject, offline receipt collection, finance review, partial payments, operator cancel, manual refunds.

What blocks **real paid operations**:

1. Approved-unpaid holds a seat **forever** (no `paymentDueAt`, no expiry).
2. No product definition of **final participant**.
3. Operator cannot answer “who is coming AND paid?” from one surface.
4. Tour mutations after registrations have **no freeze / notify / reprice policy**.
5. Member notifications are **event-only** (no inbox).
6. Driver/personal-car **settlement does not exist**.
7. Cancel and refund are **disconnected manual workflows**.
8. Post-tour closure **does not exist**.

This program freezes current truth (DP-0), resolves DEN-PROD gates, then implements money/capacity-safe slices in order. **Wallet is not required for MINIMUM PILOT.** Wallet is deferred unless DEN-PROD-05 reverses that.

**First implementation slice (this plan):** DP-0 decision + evidence freeze + test matrices. **No production implementation until required gates are resolved.**

---

## Current product baseline

Frozen from audit + code on `origin/main` (2026-08-24). Do not treat this table as a target state.

| Area | Current truth | Evidence |
|------|---------------|----------|
| Policy | `approve_then_offline_pay` | `docs/workspaces/denali/registration-payment-orchestration.mdoc` |
| Booking lifecycle | `pending → {approved,waitlisted,rejected,cancelled}`; `waitlisted → {approved,rejected,cancelled}`; `approved → cancelled` only | `packages/booking-http-contracts/src/booking-lifecycle-transitions.ts` |
| Capacity | **Only `approved` consumes seats** | `packages/workspaces/denali/src/booking/availability.ts`; catalog `DN-CAT-05` |
| Approve | Sets `status=approved`, `paymentStatus=unpaid`; free/zero → `applyFreeCollectionPayment` | `apps/api/src/bookings/create-bookings-service.ts` |
| Obligation | **Lazy resolve** — no finance row on approve | `apps/api/src/workspace-finance/infrastructure/registration-finance-obligation.adapter.ts` |
| Payment deadline | **None** | No `paymentDueAt` column on `OperatorRegistration`; maturity ledger “not started” |
| Finance collection | Offline receipt after approve; hub + tour workspace | `DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md` `READY_FOR_FIRST_CUSTOMER` |
| Installment `dueAt` | Exists on finance **schedule items** only; Denali installments **off** | `packages/finance-core/src/domain/schedule.ts`; `finance-ops-manifest.ts` |
| Refund | Manual finance refund aggregate | `FinanceRefund` Prisma; `/finance/refunds*` |
| Cancel | Operator `cancelBooking` + outbox `registration.cancelled`; **no auto refund** | `bookings.service.ts` |
| Member cancel | **Absent** | Portal grep: no self-cancel |
| Waitlist at create | **Denied** when full (not auto-waitlist) | `evaluateDenaliCreateCapacity` |
| Transport intake | `primary` / `personal_car` / `no_car_dong`; occupants 1–3 | `resolve-denali-registration-transport.ts` |
| Driver settlement | **Absent** | Audit; TW-C-06 assignment deferred |
| Roster | Transport tab = approved scalars; Finance tab = AR follow-up | `tour-workspace-transport-logic.ts` |
| Notifications | Outbox `registration.approved` → in-app structured adapter; **no portal inbox** | `dispatch-registration-approved-notification.ts` |
| Tour PATCH after regs | **Always allowed**; member intake amend blocked when approved | Phase 12.4; `DN-READ-05` |
| Unpublish | **Forbidden** `active→draft` | `DENALI_LIFECYCLE` |
| Wallet | Hidden portal stub | `member-module-stub.tsx` |
| Scheduler pattern | Denali **exposure reminder** poller exists (not payment expiry) | `start-denali-exposure-reminder-scheduler.ts` |
| Persistence | `operator_registrations` has `status`, `paymentStatus`, `approvedAt`, `registrationIntake` — **no deadline column** | `apps/api/prisma/schema.prisma` |

---

## Pilot vs paid-operations definition

| Scope | May operate if | Required DP phases | Explicitly out of scope |
|-------|----------------|--------------------|-------------------------|
| **MINIMUM PILOT** | Offline receipts, small cohort, operator follows up unpaid guests **manually**, personal-car used as **intake only** (no driver pay) | DP-0 complete (truth freeze + signed gates for “pilot without deadline” **or** DP-1 if club will approve paid tours) | Wallet, gateway, driver settlement, post-tour CRM |
| **MINIMUM PAID OPERATIONS** | Money + capacity stay consistent without spreadsheets | DP-0 + **DP-1** + **DP-2** + **DP-3** (safety) + **DP-4** (min notifications + member cancel policy) + **DP-6** (cancel↔refund link or documented SOP encoded in product) | Wallet unless DEN-PROD-05 says otherwise; full vehicle assignment; post-tour archive |
| **POST-LAUNCH** | Scale, driver pay, closure | DP-5, DP-7 remaining, Wallet if chosen | — |

**Audit allowance:** offline finance path is already `READY_FOR_FIRST_CUSTOMER`. This plan **preserves** a pilot that does **not** wait for Wallet, gateway, or post-tour CRM.

**Constraint:** a club that **approves unpaid guests onto scarce seats** cannot claim MINIMUM PAID OPERATIONS without DP-1 (or an explicit DEN-PROD-01 = “manual / no expiry” **and** an operational SOP). Leaving DEN-PROD-01 unsigned is **not** “manual by default.”

---

## Product decision gates

All gates: **`[!]` until product owner records a choice.** Cursor does not pick.

**Decision owner (all gates unless overridden):** Architect + Denali product owner (club operator stakeholder). Engineering may supply consequences; may not close the gate.

### DEN-PROD-01 — Payment deadline duration

| Field | Content |
|-------|---------|
| **Status** | `[v]` **Approved 2026-08-24** — see `docs/dev/dp-1-execution-plan.md` § Approved decisions |
| **Approved** | Workspace default **24h** after `approvedAt`; per-tour `pricing.paymentDeadlineHours`; UTC `dueAt`; operator may extend |
| **Current behavior** | No deadline. Approved-unpaid holds seat indefinitely. |
| **Product question** | How long after approval does the member have to pay? |
| **Options** | (A) 30 minutes (B) 6 hours (C) 24 hours (D) workspace default + per-tour override hours (E) `manual` / no expiry (operator chase only) (F) other explicit duration |
| **Consequences** | A–D require DP-1 persistence + worker. E keeps current capacity leak; must be **signed**, not assumed. Per-tour override needs wizard/settings field (`WZ-02` related). |
| **Affected modules** | Denali tour canonical `pricing.*`; Bookings approve path; Finance obligation/invoice read; operator/member UI; scheduler |
| **Blocked task IDs** | DP1-01…DP1-20, DP4-03, DP4-07, DP8-04 |
| **Latest safe execution point** | After DP-0 freeze; **before any DP-1 schema** |
| **Evidence needed** | Club ops interview: typical time-to-receipt; weekend vs weekday; bank transfer lag in IRR offline path |
| **Decision owner** | Product owner |

Design **must** support configurable policy even if first customer picks a single default.

---

### DEN-PROD-02 — Does approved-unpaid reserve capacity?

| Field | Content |
|-------|---------|
| **Status** | `[v]` **Approved 2026-08-24** — see `docs/dev/dp-1-execution-plan.md` § Approved decisions |
| **Approved** | **YES** — `registrationOccupiesSeat` iff `approved`; paired with DEN-PROD-04 expiry cancel |
| **Current behavior** | **YES.** Occupancy = Σ `approved.partySize`. Pending/waitlisted excluded. |
| **Product question** | Retain seat-hold on approve before money arrives? |
| **Options** | (A) Retain (pair with DEN-PROD-01/04) (B) Hold seat only when `paymentStatus=paid` or waived (C) Soft-hold with overbook policy (D) Tour-level toggle |
| **Consequences** | A = current + needs expiry. B = catalog spots inflate until paid; waitlist meaning changes; **breaks** existing `DN-CAT-05` occupancy. C = new overbook math. |
| **Affected modules** | `availability.ts`, catalog spots, Bookings approve TX, marketing availability filter |
| **Blocked task IDs** | DP1-01, DP1-05, DP2-01, DP8-03 |
| **Latest safe execution point** | DP-0. Changing occupancy formula is a **strangler** — do not pause mid-change. |
| **Evidence needed** | Confirm clubs prefer “reserve then chase pay” vs “pay then seat” |
| **Decision owner** | Product owner |

---

### DEN-PROD-03 — What is a “final participant”?

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | No single enum. Dual axis: `booking.status` + `booking.paymentStatus` + invoice remaining. Transport roster = **all approved**. Finance inbox = AR remaining. |
| **Product question** | Which semantic is “on the trip”? Compare: registration approved / payment complete / operationally confirmed / actually attending. **Do not collapse unless product decides.** |
| **Options** | (A) Approved = operational roster (current transport tab) (B) Paid or waived = commercial confirmed (C) Operator “confirmed attending” third axis (D) Day-of attendance (DP-7) separate from pre-departure roster |
| **Consequences** | Drives DP-2 projection filters, exports, DEN-PROD-06 passenger set. |
| **Affected modules** | Tour workspace tabs, Bookings CC, portal copy, future settlement |
| **Blocked task IDs** | DP2-01…DP2-12, DP5-02, DP7-02, DP8-05 |
| **Latest safe execution point** | DP-0; DP-2 design after this gate |
| **Evidence needed** | Day-of leader question: unpaid approved still boarded today? |
| **Decision owner** | Product owner |

---

### DEN-PROD-04 — What happens when payment deadline expires?

| Field | Content |
|-------|---------|
| **Status** | `[v]` **Approved 2026-08-24** — see `docs/dev/dp-1-execution-plan.md` § Approved decisions |
| **Approved** | Finance **Payment Hold** + `approved → cancelled` (`cancelSource=payment_deadline`); partial still expires; auto-promote waitlist; no new booking status |
| **Current behavior** | N/A — no expiry. Lifecycle allows **`approved → cancelled` only**. No `payment_expired` status exists. |
| **Product question** | Expiry action + race when payment succeeds during expiry. |
| **Options** | (A) `approved → cancelled` + release seat (reuse terminal) (B) **New** status (e.g. `payment_expired`) + release seat — **requires booking-http-contracts change** (C) Stay `approved`, flag expired, operator review queue, seat still held until operator acts (D) Auto-promote waitlist after release (E) A or B **without** auto-promote |
| **Consequences** | A reuses cancel outbox; members see “cancelled” which may be wrong copy. B is a **platform booking contract** change (workspace-sdk / booking-http-contracts) — doc-first required. C does not fix capacity leak. Race: must define winner when receipt-approve and expiry TX overlap. |
| **Affected modules** | `booking-http-contracts`, Bookings repositories, Finance receipt-approve, waitlist promote, portal i18n, outbox |
| **Blocked task IDs** | DP1-04, DP1-05, DP1-08, DP1-09, DP6-04 |
| **Latest safe execution point** | Before booking status enum / transition table edits |
| **Evidence needed** | Legal/ops: is non-payment a cancellation or a distinct failure? |
| **Decision owner** | Product owner + Architect (if new booking status) |

---

### DEN-PROD-05 — Wallet launch requirement

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | Member wallet = hidden stub. Operator prepayments panel **off**. Finance ledger ≠ wallet. |
| **Product question** | Launch now without Wallet vs Wallet before paid operations? |
| **Options** | (A) **Not required** for MINIMUM PILOT / MINIMUM PAID OPERATIONS (audit recommendation) (B) Required before any paid ops (C) Required only if DEN-PROD-08 = wallet credit or DP-5 pays drivers internally |
| **Consequences** | A: refunds stay manual/offline; driver pay = Finance credit / manual payout seam. B: large new domain. C: couples Wallet to settlement/refund gates. |
| **Affected modules** | Portal `/me/wallet`, finance-core, DP-5, DP-6 |
| **Blocked task IDs** | Wallet tasks (none in first-customer mandatory set unless B/C) |
| **Latest safe execution point** | DP-0; DP-5/DP-6 destination design |
| **Evidence needed** | Whether first club needs member credit balance |
| **Decision owner** | Product owner |

**Plan default until signed:** treat (A) as **working assumption for sequencing only**, not a closed decision. Do not implement Wallet.

---

### DEN-PROD-06 — Driver compensation basis

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | `dongAmount` = **passenger pricing**, not driver pay. No compensation. Offered seats ≠ assigned ≠ carried. |
| **Product question** | Compensate on offered seats, assigned passengers, or actually carried? |
| **Options** | (A) Offered seat count at registration (B) Assigned passengers at roster freeze (C) Actually carried (attendance) (D) Operator-entered carried count |
| **Consequences** | A can overpay. C requires DP-7 attendance. B requires allocation model (today **not implemented**). |
| **Affected modules** | Transport intake, future Settlement, Finance payout |
| **Blocked task IDs** | DP5-01…DP5-16, DP7-04 |
| **Latest safe execution point** | After DEN-PROD-03 (who is a passenger) |
| **Evidence needed** | Club compensation custom (per seat vs per km vs flat) |
| **Decision owner** | Product owner |

---

### DEN-PROD-07 — When driver settlement becomes payable

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | N/A |
| **Product question** | Payable at allocation, roster freeze, departure, completion, or operator confirmation? |
| **Options** | (A) On passenger allocation (B) Roster freeze (C) Tour departure (D) Tour completion (E) Operator confirmation only |
| **Consequences** | A/B risk paying before trip runs. D depends on DP-7. E is safest for MINIMUM PAID OPERATIONS without post-tour. |
| **Affected modules** | Settlement status machine, Finance, DP-7 |
| **Blocked task IDs** | DP5-06, DP5-07, DP7-04 |
| **Latest safe execution point** | DP-5 design; can ship manual confirmation first |
| **Evidence needed** | When clubs currently pay drivers (cash on the day vs after) |
| **Decision owner** | Product owner |

---

### DEN-PROD-08 — Refund destination

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | Manual `FinanceRefund` lifecycle (`request/approve/complete/reject/cancel`). Destination is **operator-completed offline** (evidence file/note). No wallet credit path. |
| **Product question** | Original payment method vs manual payout vs wallet vs configurable? |
| **Options** | (A) Manual payout only (current, encode as product) (B) Original method (no gateway today — **not operable** until gateway) (C) Wallet credit (needs DEN-PROD-05 ≠ A) (D) Configurable per refund |
| **Consequences** | A unblocks DP-6 orchestration without Wallet. B blocked by no gateway. |
| **Affected modules** | `finance-core` refunds, portal, DP-6 |
| **Blocked task IDs** | DP6-05, DP6-06 |
| **Latest safe execution point** | DP-6; can implement eligibility/amount before destination automation |
| **Evidence needed** | How first club refunds bank transfers today |
| **Decision owner** | Product owner |

---

### DEN-PROD-09 — Member cancellation rights

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | Operator cancel only. Catalog shows `cancellationDeadlineHours` / `cancellationPenaltyPercentage` as **informational**. Penalty **not enforced**. |
| **Product question** | Can members cancel pending / waitlisted / approved unpaid / paid? Penalty? |
| **Options** | (A) Pending+waitlisted only (B) Also approved unpaid (C) Also paid with penalty math (D) Never — operator only (signed SOP) |
| **Consequences** | B/C intersect DP-1 expiry and DP-6 refund. Catalog fields become lies unless C or copy changes. |
| **Affected modules** | Portal, Bookings cancel API (member actor), Finance, catalog copy |
| **Blocked task IDs** | DP4-01, DP4-02, DP6-01, DP6-07 |
| **Latest safe execution point** | DP-4; do not add portal button before this gate |
| **Evidence needed** | Club policy for member-initiated drops |
| **Decision owner** | Product owner |

---

### DEN-PROD-10 — Tour mutation under active registrations

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | Flat-edit PATCH always allowed. Registration intake snapshot frozen when approved (`DN-READ-05`). Price/date/transport on tour can diverge from snapshots. No member notify. |
| **Product question** | Which fields are SAFE_MUTABLE / MUTABLE_WITH_NOTIFICATION / MUTABLE_WITH_REPRICING / FROZEN_AFTER_REGISTRATION / FROZEN_AFTER_PAYMENT / REQUIRES_OPERATOR_OVERRIDE? |
| **Consequences** | Repricing touches Finance obligation freeze (today lazy). Date change touches departure/capacity UX. |
| **Affected modules** | Flat edit, canonical validation, Finance, notifications, DP-3 |
| **Blocked task IDs** | DP3-01…DP3-14, DP4-05 |
| **Latest safe execution point** | Before any freeze enforcement in PATCH |
| **Evidence needed** | Field classification workshop (matrix in DP-3) signed |
| **Decision owner** | Product owner |

---

### DEN-PROD-11 — Obligation freeze on approve vs keep lazy

| Field | Content |
|-------|---------|
| **Status** | `[v]` **Approved 2026-08-24** — see `docs/dev/dp-1-execution-plan.md` § Approved decisions |
| **Approved** | **Freeze Commercial Quote on approve** (amend DEC-CQ-001); payable SoT = `finance_commercial_quotes`; `dueAt` on Hold only; grandfather approved-unpaid without hold |
| **Current behavior** | PAY-FIN-02: obligation compiled at read; first money path may `ensureQuoteFrozenForMoneyPath`. Approve creates **no** payment row. |
| **Product question** | When is commercial quote frozen relative to `paymentDueAt`? |
| **Options** | (A) Keep lazy until first money path; deadline timestamp still stored (B) Freeze quote on approve (C) Freeze on deadline materialization only |
| **Consequences** | A risks amount changing if tour price mutates (DEN-PROD-10). B is safer for paid ops; changes finance-on-approve (currently **eventReaction mode=none**). |
| **Affected modules** | `finance.service.ts`, obligation adapter, Bookings approve hook |
| **Blocked task IDs** | DP1-03, DP3-06, DP6-03 |
| **Latest safe execution point** | DP-1 design; do not add silent freeze in approve without this gate |
| **Evidence needed** | Whether clubs change price after first approval |
| **Decision owner** | Product owner + Finance owner |

---

### DEN-PROD-12 — Notification channels for first customer

| Field | Content |
|-------|---------|
| **Status** | `[!]` |
| **Current behavior** | `registration.approved` → structured in-app adapter; **no portal inbox UI**. Reject silent. Waitlist/cancel outbox exist without member dispatch. |
| **Product question** | Email / SMS / portal inbox / operator-told-offline for MINIMUM PAID OPERATIONS? |
| **Options** | (A) Portal inbox only (B) Email (C) SMS (D) Operator WhatsApp SOP, product shows status only (E) A+B |
| **Consequences** | A needs portal module (DL-20 deferred). D is a **signed** product choice, not a gap hide. |
| **Affected modules** | Notifications port, portal shell, outbox relay |
| **Blocked task IDs** | DP4-04…DP4-10 |
| **Latest safe execution point** | DP-4; DP-1 may emit events without delivery UI |
| **Evidence needed** | How first club contacts members today |
| **Decision owner** | Product owner |

---

## Phase table

| Phase | Goal | Task count | Size | Risk | Dependencies | Automated exit | Browser exit |
|-------|------|------------|------|------|--------------|----------------|--------------|
| **DP-0** | Truth freeze + signed gates | 8 | MEDIUM | LOW (docs/evidence); HIGH if skipped | None | Freeze pack + decision records exist | Baseline screenshots of **current** golden path (no new behavior) |
| **DP-1** | Payment deadline / approved-unpaid lifecycle | 20 | LARGE | **FINANCIAL_HIGH** + concurrency HIGH | DP-0; DEN-PROD-01,02,04,11 | 20-scenario domain+integration matrix green | Operator approve→countdown; member dueAt; expiry; paid-before-expiry; race evidence |
| **DP-2** | Final participation + unified roster | 12 | LARGE | MEDIUM | DP-0; DEN-PROD-03; DP-1 if roster shows deadline | Projection contract tests + isolation | One tour workspace surface answers the eight operator questions |
| **DP-3** | Tour mutation safety | 14 | MEDIUM | HIGH (money/capacity) | DP-0; DEN-PROD-10,11 | Mutation matrix tests | Edit after regs: frozen fields blocked; notify path if chosen |
| **DP-4** | Member self-service + notifications | 12 | MEDIUM | MEDIUM | DP-0; DEN-PROD-09,12; DP-1 events | Portal contract + outbox dispatch tests | Desktop+mobile portal: cancel (if allowed), dueAt, status copy |
| **DP-5** | Driver / personal-car settlement | 16 | LARGE | **FINANCIAL_HIGH** | DP-0; DEN-PROD-05,06,07; DP-2 passenger set | Settlement domain + no Transport→balance | 3-offer / 2-carried scenario in UI |
| **DP-6** | Refund & cancellation completion | 12 | MEDIUM | **FINANCIAL_HIGH** | DP-0; DEN-PROD-08,09; reuse finance refunds | No double refund; cancel releases seat | Member/operator/tour cancel journeys |
| **DP-7** | Post-tour closure | 10 | SMALL–MEDIUM | LOW–MEDIUM | DP-2; DP-5/6 as classified | Closure state tests if implemented | Optional for MINIMUM PAID OPERATIONS |
| **DP-8** | Golden real-club certification | 10 | LARGE (validation burden) | HIGH (browser) | Required first-customer phases | Full automated golden | Full role-play browser pack |

---

## Detailed task ledger

### DP-0 — Product Truth Freeze & Decision Gates

**Goal:** Freeze current behavior. Resolve or explicitly defer gates. No behavior change.

| ID | Objective | Invariant | Decision deps | Files / modules | DB | Automated coverage | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|-----------------|-----|--------------------|---------|----------|------|--------|
| DP0-01 | Executable current-behavior pack (approve, unpaid, seats, capacity, waitlist, obligation, partial pay, refund, personal-car, roster, portal, mutation) | Document **as-is**, no target invention | — | Audit + cited tests (`SMK-P9-04`, `SMK-PTL-04`, `PAY-FIN-02`, `DN-CAT-05`, `DEN-TRANS-*`, `DN-READ-05`) | None | Re-run **existing** targeted specs only; attach logs to freeze pack | Baseline capture current UI | N/A | LOW | `[ ]` |
| DP0-02 | Sign DEN-PROD-01…12 records (or signed DEFER with date) | Unsigned gate remains `[!]` | Product owner | This plan | None | Decision checklist in CI doc-guard (optional later) | — | N/A | LOW | `[~]` 01/02/04/11 `[v]` in `dp-1-execution-plan.md`; 03,05–10,12 still `[!]` |
| DP0-03 | Freeze DP-1 20-scenario **expected** columns only after 01/02/04/11 | No expected states invented | DEN-PROD-01,02,04,11 | `docs/dev/dp-1-execution-plan.md` § 20-scenario matrix | None | Matrix review | — | N/A | LOW | `[v]` |
| DP0-04 | Contract inventory: Booking / Finance / Portal / Transport / Outbox / Scheduler | No silent contract expansion | — | `booking-http-contracts`, `finance-http`, `registration-payment-orchestration.mdoc`, `cw7-05-workspace-transport-contract.md` | None | Inventory appendix | — | N/A | LOW | `[ ]` |
| DP0-05 | Sign MINIMUM PILOT vs MINIMUM PAID OPERATIONS scope | Pilot must not silently include Wallet/settlement | DEN-PROD-05 | This plan | None | — | — | N/A | LOW | `[!]` |
| DP0-06 | Physical baseline: operator login→list; portal registration detail awaiting approval; finance outstanding; transport roster | Evidence of **current** product | — | apps/web, portal, marketing | None | — | Desktop 1440 operator; portal 1440+390 | N/A | LOW | `[ ]` |
| DP0-07 | Inventory wizard gap `registrationApproval` / `paymentCollection` (no UI) | Do not implement in DP-0 | — | `denali-wizard-template-roadmap.ts` | None | — | Screenshot settings vs wizard | N/A | LOW | `[ ]` |
| DP0-08 | Phase closure: all freeze artifacts stored; gates signed or deferred | No DP-1 impl until DP0-02 for 01/02/04 | DP0-02 | `docs/dev/` | None | Doc presence | Baseline pack attached | N/A | LOW | `[ ]` |

**DP-0 automated exit:** freeze pack + contract inventory.  
**DP-0 browser exit:** current-path screenshots + network traces (read-only).  
**DP-0 `[x]`:** product owner acknowledged freeze; required gates signed or explicitly deferred.

---

### DP-1 — Payment Deadline / Approved-Unpaid Lifecycle

**Execution plan:** `docs/dev/dp-1-execution-plan.md` — status **READY_FOR_TEST_FIRST_IMPLEMENTATION**.

**Do not execute production behavior until failing DP-1 tests exist (see execution plan § First implementation slice).**

**Ownership (design constraint — not an implementation):**

| Concern | Owner | Must not |
|---------|-------|----------|
| Policy duration / per-tour override | **Workspace / tour canonical** (Denali) | Hardcode hours in Bookings |
| `paymentDueAt` timestamp | **Finance** (invoice/hold clock) **or** Bookings column **as decided in DP1-01** — see options below | Duplicate clocks that can diverge |
| Seat release / lifecycle transition | **Bookings** | Finance directly flipping occupancy |
| Waitlist promotion | **Bookings** | Finance promoting |
| Idempotent expiry worker | **API scheduler** (pattern: exposure reminder) + TX | Ad-hoc cron in Next.js |
| Member/operator display | Portal / web **reads same dueAt** | UI computing deadline from `approvedAt` locally with a different clock |

**Clock:** persist **UTC ISO-8601**. Display in operator/member locale. DST: store instant, not civil “24h local” unless DEN-PROD-01 says local-calendar days (would be extra decision — default evidence uses UTC instants like `startDateTime`).

**Proposed persistence options (not selected):**

- **P-Fin:** Finance schedule/hold row with `dueAt` (reuse installment `dueAt` shape — **risk:** installments currently off and semantically different).
- **P-Book:** `operator_registrations.payment_due_at` (+ index for worker).
- **P-Both:** Finance owns dueAt; Bookings stores copy — **forbidden unless** single-writer + projection.

| ID | Objective | Invariant | Decision deps | Files / modules | DB impact | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|-----------------|-----------|-----------|---------|----------|------|--------|
| DP1-01 | Cross-service contract: who writes dueAt, who expires, event names | One writer for dueAt | 01,02,04,11 | New docs under `docs/workspaces/denali/`; booking + finance ports | Plan only until signed | Contract tests **written first** | — | Doc revert | HIGH | `[!]` |
| DP1-02 | Schema + backfill plan | Existing approved-unpaid rows: null dueAt = grandfather **or** backfill from `approvedAt+policy` — **must be decided** | 01 | Prisma `OperatorRegistration` and/or finance | Nullable column first | Migration tests | — | Expand-only migration | FINANCIAL_HIGH | `[!]` |
| DP1-03 | Materialize deadline on approve (and auto-approve) | Idempotent; free/waived skip or immediate paid | 01,11 | `create-bookings-service.ts`, `registration.service.ts` auto-approve | Write dueAt | Domain+integration S1 | Operator sees due | Feature flag off | FINANCIAL_HIGH | `[!]` |
| DP1-04 | Expiry worker: scan due, TX, outbox | Idempotent; skip if paid; skip if not approved | 04 | New scheduler beside exposure reminder; Bookings | Read dueAt | S4–S9, S18–S20 | Operator list after expiry | Disable scheduler | FINANCIAL_HIGH | `[!]` |
| DP1-05 | Payment vs expiry race | Exactly one winner; no double occupancy change | 04 | Bookings TX + finance receipt-approve | Row lock | Deterministic concurrency test | — | — | FINANCIAL_HIGH | `[!]` |
| DP1-06 | Partial payment before expiry | Remaining > 0 does **not** expire unless policy says otherwise — **needs product note in 01/04** | 01,04 | Finance + worker | — | S10 | Finance + portal remaining | — | FINANCIAL_HIGH | `[!]` |
| DP1-07 | Operator extend deadline | Audit who/when; new dueAt UTC | 01 | Bookings or Finance API | Update dueAt | S11 | Operator extend UI | — | MEDIUM | `[!]` |
| DP1-08 | Events: `payment.due_scheduled`, `payment.expired` (names TBD) | Outbox durable; tenant-scoped | 04,12 | outbox relay | Outbox rows | Integration | — | — | MEDIUM | `[!]` |
| DP1-09 | Waitlist on expiry | Capacity then promote **only if** 04 includes promote | 04 | `promoteWaitlist` | Occupancy | S6, S7, S20 | Waitlist tab | — | HIGH | `[!]` |
| DP1-10 | Member display dueAt + countdown | Same instant as operator | 01 | Portal detail | Read | S16, S17 | Portal 1440+390 | — | MEDIUM | `[!]` |
| DP1-11 | Operator display dueAt / overdue (payment, not departure badge) | Do not overload `booking-overdue-badge` (departure 48h) | 01 | Bookings CC, tour finance | Read | S17 | Operator 1440 | — | MEDIUM | `[!]` |
| DP1-12 | Policy change after approval | Existing dueAt **immutable** or recompute — **product** | 01,10 | Tour PATCH vs booking | — | S14 | — | — | HIGH | `[!]` |
| DP1-13 | Member cancel before pay (if 09 allows) | Releases seat; cancels hold | 09 | Portal + Bookings | Status | S12 | Portal | — | HIGH | `[!]` |
| DP1-14 | Operator cancel while hold active | Existing cancel + dueAt cleared | — | `cancelBooking` | Status | S13 | Operator | — | MEDIUM | `[ ]` blocked by 04 copy |
| DP1-15 | Isolation: tenant A expiry cannot touch tenant B | Workspace isolation | — | Worker query `tenantId` | Index `(tenant_id, payment_due_at)` | Cross-tenant negative | — | — | HIGH | `[!]` |
| DP1-16 | Financial safety: no duplicate obligation, integer minor units | Existing finance invariants | 11 | finance-core | — | Finance regression | — | — | FINANCIAL_HIGH | `[!]` |
| DP1-17 | Memory driver + Postgres parity | Dev memory API must not lie | — | in-memory bookings repo | — | Dual driver tests | — | — | HIGH | `[!]` |
| DP1-18 | Automated cert pack for 20 scenarios | Matrix attached | 01,02,04 | `packages/workspaces/denali/test`, `apps/api/test` | — | All 20 | — | — | HIGH | `[!]` |
| DP1-19 | Browser cert pack | UI+network+domain | 01,02,04 | Playwright + evidence dir | — | — | See browser matrix | — | HIGH | `[!]` |
| DP1-20 | Phase closure | `[v]` then `[x]` | DP1-18, DP1-19 | — | — | — | RUNTIME_FINDING process | — | HIGH | `[!]` |

**Strangler pause rule:** do not pause between writing dueAt and running expiry (split-brain holds). Pause only after worker **off** and column unused, or after full DP-1 `[x]`.

---

### DP-2 — Final Participation Semantics + Unified Operational Roster

Read-model / projection. **Do not merge Bookings and Finance tables.** SoT remains: Bookings lifecycle, Finance invoice, Transport intake scalars.

| ID | Objective | Invariant | Decision deps | Modules | DB | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|---------|-----|-----------|---------|----------|------|--------|
| DP2-01 | Semantic map: approved / paid / expected-to-attend / waitlist / driver / passengers | No collapsed enum unless 03 says so | 03 | Docs + types | None or view | Contract | — | — | MEDIUM | `[!]` |
| DP2-02 | Tour-scoped roster projection API | Tenant isolation; no PII leak to catalog | 03 | `apps/api` bookings+finance compose | Optional read table | Isolation tests | — | Drop view | MEDIUM | `[!]` |
| DP2-03 | Single operator surface (tour workspace) | Answers 8 questions without spreadsheet | 03 | `apps/web` tour workspace | — | Component tests | Desktop 1440 | Hide tab | MEDIUM | `[!]` |
| DP2-04 | Filter: approved | Matches Bookings | 03 | Projection | — | Golden | Browser | — | LOW | `[!]` |
| DP2-05 | Filter: paid / owes | Invoice remaining SoT (PAY-FIN-02) | 03 | Finance compose | — | Golden | Browser | — | MEDIUM | `[!]` |
| DP2-06 | Filter: waitlist | Status waitlisted | — | Bookings | — | H4b regression | Browser | — | LOW | `[ ]` |
| DP2-07 | Expected to attend | Per 03 | 03 | Projection | — | Golden | Browser | — | HIGH | `[!]` |
| DP2-08 | Driver + passenger grouping | Intake `personal_car` + occupants; **assignment still absent** | 06 | Transport scalars | — | DEN-TRANS regression | Browser | — | MEDIUM | `[!]` |
| DP2-09 | Deadline column if DP-1 live | Same dueAt | DP-1 | Compose | — | S17 | Browser | — | MEDIUM | `[!]` |
| DP2-10 | Export (CSV) optional | Not required for MINIMUM PILOT | — | Web | — | — | — | — | LOW | `[ ]` FUTURE |
| DP2-11 | Browser cert | Operator 1440; tablet 768 optional | 03 | — | — | — | Required | — | MEDIUM | `[!]` |
| DP2-12 | Phase closure | `[x]` only with browser | — | — | — | — | — | — | MEDIUM | `[!]` |

---

### DP-3 — Tour Mutation Safety After Registrations

Field classes (product fills after DEN-PROD-10). Engineering must not assign classes.

**Candidate fields to classify (not classified here):** `startDateTime`, `endDateTime`, `capacityMax`, `pricing.*`, `transport.*`, `participants.gearItems`, `program.itinerary`, `participants.minimumAge` / fitness, `publishStatus`.

| ID | Objective | Invariant | Decision deps | Modules | DB | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|---------|-----|-----------|---------|----------|------|--------|
| DP3-01 | Signed field-class matrix | Every listed field has one class | 10 | Docs | None | Matrix review | — | — | HIGH | `[!]` |
| DP3-02 | Count existing registrations on PATCH | Occupancy + pending | — | Tour update pipeline | Read bookings | Integration | — | — | MEDIUM | `[ ]` |
| DP3-03 | Enforce FROZEN_* | 409/422 stable codes | 10 | `apps/api` tours PATCH; flat edit | — | Domain+HTTP | Operator edit | Flag off | HIGH | `[!]` |
| DP3-04 | SAFE_MUTABLE | No notify | 10 | — | — | Tests | — | — | LOW | `[!]` |
| DP3-05 | MUTABLE_WITH_NOTIFICATION | Event + DP-4 delivery | 10,12 | Outbox | Outbox | Event test | Member sees if inbox exists | — | MEDIUM | `[!]` |
| DP3-06 | MUTABLE_WITH_REPRICING | Obligation/invoice policy | 10,11 | Finance | Maybe freeze | Finance tests | — | — | FINANCIAL_HIGH | `[!]` |
| DP3-07 | Capacity down vs approved occupancy | Reject or waitlist overflow — **product** | 02,10 | Bookings+tours | — | Integration | — | — | HIGH | `[!]` |
| DP3-08 | Snapshot vs live tour fields | Intake snapshot preserved | — | registrationIntake | JSON | DN-READ-05 regression | — | — | MEDIUM | `[ ]` |
| DP3-09 | Refund/cancel impact of date change | Per 08/09 | 08,09,10 | DP-6 | — | — | — | — | HIGH | `[!]` |
| DP3-10 | Operator override path | Audit trail | 10 | PATCH roots | Audit | Test | UI confirm | — | HIGH | `[!]` |
| DP3-11 | Isolation | Tenant | — | — | — | Negative | — | — | MEDIUM | `[ ]` |
| DP3-12 | Automated matrix | All classes | 10 | — | — | Full | — | — | HIGH | `[!]` |
| DP3-13 | Browser cert | Operator edits published tour with regs | 10 | — | — | — | 1440 | — | HIGH | `[!]` |
| DP3-14 | Phase closure | — | — | — | — | — | — | — | HIGH | `[!]` |

---

### DP-4 — Member Self-Service + Notifications

Distinguish: **EVENT_EXISTS** / **NOTIFICATION_DELIVERY_EXISTS** / **PORTAL_INBOX_EXISTS**.

Current: approved = EVENT + structured delivery adapter; **PORTAL_INBOX_EXISTS = no**.

| ID | Objective | Invariant | Decision deps | Modules | DB | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|---------|-----|-----------|---------|----------|------|--------|
| DP4-01 | Member cancel API (if 09 ≠ D) | Same TX rules as operator cancel | 09 | Portal BFF, Bookings | Status | Domain+HTTP | Portal 1440+390 | Disable route | HIGH | `[!]` |
| DP4-02 | Member cancel UX + copy | No button if forbidden | 09 | Portal | — | Component | Mobile | Hide | MEDIUM | `[!]` |
| DP4-03 | Payment deadline + payment state on detail | Same dueAt as DP-1 | 01 | Portal | Read | S16 | Mobile+desktop | — | MEDIUM | `[!]` |
| DP4-04 | Approval / waitlist explanation copy | Dual-axis clear | 03 | i18n | — | — | Browser | — | LOW | `[ ]` |
| DP4-05 | Tour-change notification | Delivery per 12 | 10,12 | Notifications | Outbox | Dispatch tests | Inbox if A | Flag | MEDIUM | `[!]` |
| DP4-06 | Payment due / expiring notification | Not event-only | 01,12 | Notifications | — | Dispatch | — | Flag | MEDIUM | `[!]` |
| DP4-07 | Expired / cancelled / refund status on portal | Honest labels | 04,08,09 | Portal | — | Contract | Browser | — | MEDIUM | `[!]` |
| DP4-08 | Portal inbox module (if 12 includes A) | Entitlements; isolation | 12 | `apps/portal` | Store TBD | Isolation | Desktop+mobile | Hidden tier | MEDIUM | `[!]` |
| DP4-09 | Email/SMS (if 12 includes B/C) | Idempotent templates | 12 | Delivery adapters | — | Adapter tests | — | Flag | MEDIUM | `[!]` |
| DP4-10 | Reject notification (today silent) | Product: keep silent or add event | 12 | Outbox policy CW0-04 | — | — | — | — | MEDIUM | `[!]` extra product note |
| DP4-11 | Browser cert | Member journeys | 09,12 | — | — | — | 1440+390 | — | MEDIUM | `[!]` |
| DP4-12 | Phase closure | Delivery ≠ event | 12 | — | — | — | — | — | MEDIUM | `[!]` |

---

### DP-5 — Driver / Personal-Car Settlement

**Boundary:** Transport → **allocation/carried facts** → **Settlement** → Finance payout/credit. **Transport MUST NOT mutate Wallet/ledger balance.**

Prefer: **manual payout / Finance credit now; Wallet later** without rewriting Transport.

Scenario to plan (not execute): driver offers **3** seats, **2** assigned/carried.

| ID | Objective | Invariant | Decision deps | Modules | DB | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|---------|-----|-----------|---------|----------|------|--------|
| DP5-01 | Settlement domain (workspace-owned vs finance submodule) | No Transport ledger writes | 05,06,07 | New module TBD — **not** `workspace-sdk` Denali leak | New tables | Domain | — | Unused tables | FINANCIAL_HIGH | `[!]` |
| DP5-02 | Offered capacity vs assigned vs carried fields | Three numbers stored distinctly | 06 | Transport + settlement | Columns | Unit | — | — | HIGH | `[!]` |
| DP5-03 | Allocation (if 06 needs assigned) | Today assignment **out of scope** TW-C-06 — product may keep manual carried | 06 | Tour workspace | — | — | UI | — | HIGH | `[!]` |
| DP5-04 | Compensation amount (integer minor) | Idempotent calc | 06 | Settlement | — | Domain | — | — | FINANCIAL_HIGH | `[!]` |
| DP5-05 | Status machine: draft/confirmed/payable/paid/corrected | No double pay | 07 | Settlement+Finance | Status | Domain | — | — | FINANCIAL_HIGH | `[!]` |
| DP5-06 | Operator approval of settlement | Audit | 07 | Web | — | HTTP | 1440 | — | HIGH | `[!]` |
| DP5-07 | Finance payout/credit seam (not Wallet required) | XOR with future Wallet | 05,08 | finance-core port | Payment or ledger | Finance tests | — | — | FINANCIAL_HIGH | `[!]` |
| DP5-08 | Passenger cancel impact | Recalc or freeze per 06/07 | 09 | Settlement | — | Domain | — | — | HIGH | `[!]` |
| DP5-09 | Driver cancel | Void/correct settlement | — | Settlement | — | Domain | — | — | HIGH | `[!]` |
| DP5-10 | Tour cancel | Batch void | — | Settlement+DP-6 | — | Integration | — | — | HIGH | `[!]` |
| DP5-11 | Correction + audit | Immutable evidence + reversal | — | Settlement | — | Domain | — | — | FINANCIAL_HIGH | `[!]` |
| DP5-12 | Isolation | Tenant | — | — | tenant_id | Negative | — | — | HIGH | `[ ]` |
| DP5-13 | 3-offer / 2-carried golden | Matches 06 | 06,07 | — | — | Domain+E2E | Browser | — | FINANCIAL_HIGH | `[!]` |
| DP5-14 | Migration | Empty prod assumption forbidden | — | Prisma | Yes | Migrate | — | Expand | MEDIUM | `[!]` |
| DP5-15 | Browser cert | Operator settlement UI | 06,07 | — | — | — | 1440 | — | HIGH | `[!]` |
| DP5-16 | Phase closure | — | — | — | — | — | — | — | FINANCIAL_HIGH | `[!]` |

**MINIMUM PAID OPERATIONS:** DP-5 is **REQUIRED** only for clubs compensating drivers in-product. Otherwise **SOON_AFTER_LAUNCH** / **FUTURE** per DP-7 classification. First-customer clubs using bus-only can defer.

---

### DP-6 — Refund & Cancellation Completion

**Reuse** `FinanceRefund` + `/finance/refunds*`. Do not duplicate refund state machines.

| ID | Objective | Invariant | Decision deps | Modules | DB | Automated | Browser | Rollback | Risk | Status |
|----|-----------|-----------|---------------|---------|-----|-----------|---------|----------|------|--------|
| DP6-01 | Member cancel → eligibility | Per 09 | 09 | Portal+Bookings | Status | Domain | Portal | — | HIGH | `[!]` |
| DP6-02 | Operator cancel → eligibility | Capacity release already exists | — | Bookings | Status | Regression | Operator | — | MEDIUM | `[ ]` |
| DP6-03 | Paid registration cancel | Refund request created or explicit skip | 08 | Bookings→Finance hook | Refund row | No double refund | Both | Flag | FINANCIAL_HIGH | `[!]` |
| DP6-04 | Expiry (DP-1) vs refund | Unpaid expiry typically **no refund** | 04,08 | Worker | — | Domain | — | — | HIGH | `[!]` |
| DP6-05 | Amount policy | Penalty from catalog fields **or** full — product | 08,09 | Finance | — | Domain | — | — | FINANCIAL_HIGH | `[!]` |
| DP6-06 | Destination | Manual vs wallet | 05,08 | Refund complete | Evidence | — | Operator complete | — | FINANCIAL_HIGH | `[!]` |
| DP6-07 | Partial payment refund | Remaining + captured | 08 | finance-core | — | Existing partial + new | — | — | FINANCIAL_HIGH | `[!]` |
| DP6-08 | Tour cancellation | Bulk cancel + refunds | 08,10 | Tours+Bookings+Finance | Many | Isolation+idempotency | Operator | — | FINANCIAL_HIGH | `[!]` |
| DP6-09 | Waitlist impact | Seats free → optional promote | 04 | Bookings | Occupancy | Integration | — | — | HIGH | `[!]` |
| DP6-10 | Events/audit | Outbox + refund audit | — | Existing | — | Tests | — | — | MEDIUM | `[ ]` |
| DP6-11 | Browser cert | Paid cancel+refund path | 08,09 | — | — | — | 1440 + portal | — | HIGH | `[!]` |
| DP6-12 | Phase closure | — | — | — | — | — | — | — | FINANCIAL_HIGH | `[!]` |

---

### DP-7 — Post-Tour Operational Closure

Classify each task. Avoid CRM/reporting overbuild.

| ID | Objective | Class | Decision deps | Risk | Status |
|----|-----------|-------|---------------|------|--------|
| DP7-01 | Tour `completed`/`closed` operational state | **SOON_AFTER_LAUNCH** (not MINIMUM PILOT) | — | MEDIUM | `[ ]` |
| DP7-02 | Attendance vs roster | **FUTURE** unless DEN-PROD-03 = actually attending or DEN-PROD-06 = carried | 03,06 | MEDIUM | `[!]` |
| DP7-03 | Unresolved balances report (reuse outstanding) | **REQUIRED_BEFORE_PAID_OPERATIONS** if clubs close trips with AR — else **SOON_AFTER_LAUNCH** | — | MEDIUM | `[ ]` |
| DP7-04 | Driver settlements closure | **REQUIRED** only if DP-5 in paid-ops scope | 07 | FINANCIAL_HIGH | `[!]` |
| DP7-05 | Outstanding refunds drain | **REQUIRED_BEFORE_PAID_OPERATIONS** as finance SOP + UI already exists | 08 | MEDIUM | `[ ]` |
| DP7-06 | Finance closure flag per tour | **SOON_AFTER_LAUNCH** | — | MEDIUM | `[ ]` |
| DP7-07 | Export/reporting | **FUTURE** (DP2-10 may suffice) | — | LOW | `[ ]` |
| DP7-08 | Archive | **FUTURE** | — | LOW | `[ ]` |
| DP7-09 | Browser cert if 01 implemented | — | — | MEDIUM | `[ ]` |
| DP7-10 | Phase closure | — | — | LOW | `[ ]` |

---

### DP-8 — Golden Denali Real-Club Certification

Primarily **runtime/browser**. Roles: OPERATOR, MEMBER A, MEMBER B, WAITLIST MEMBER, DRIVER MEMBER.

| ID | Objective | Status |
|----|-----------|--------|
| DP8-01 | Script golden journey (login→wizard→draft→resume→publish) | `[ ]` |
| DP8-02 | Members register (A, B, waitlist, driver personal-car) | `[ ]` |
| DP8-03 | Operator approve / waitlist / reject | `[ ]` |
| DP8-04 | Finance obligation + paid path + expiry path (if DP-1 in scope) | `[!]` |
| DP8-05 | Roster: paid/unpaid/driver/passenger | `[!]` |
| DP8-06 | Cancellation/refund where supported | `[!]` |
| DP8-07 | Settlement if DP-5 in scope else **N/A signed skip** | `[!]` |
| DP8-08 | Portal member-facing status (desktop+mobile) | `[ ]` |
| DP8-09 | Evidence pack: screenshots + HAR/network + console + domain state | `[ ]` |
| DP8-10 | Phase `[x]` only if in-scope DP phases `[x]` | `[ ]` |

---

## Scenario matrices

### DP-1 mandatory (20)

**Normative expected outcomes** (no TBD): `docs/dev/dp-1-execution-plan.md` § 20-scenario matrix. Summary below retained for index only.

| # | Scenario | Registration state (TBD) | Payment state (TBD) | Capacity | Finance | Event/outbox | UI evidence |
|---|----------|--------------------------|---------------------|----------|---------|--------------|-------------|
| 1 | approve → unpaid → deadline created | TBD | unpaid + dueAt | hold if 02=A | obligation per 11 | due scheduled | operator+member dueAt |
| 2 | payment before deadline | approved | paid / remaining 0 | still held | captured | paid | both UIs paid |
| 3 | payment exactly near deadline | race → DP1-05 | TBD | one winner | one capture | exactly one expiry **or** paid | network both TX |
| 4 | expiry without payment | per 04 | unpaid | release if 04 A/B/D | no refund typically | expired | operator+member |
| 5 | expiry releases capacity | — | — | spotsRemaining +party | — | — | catalog spots |
| 6 | expiry with waitlist | promote if 04 D | — | waitlisted→approved | new hold? | promote+approve | waitlist tab |
| 7 | expiry without waitlist | no promote | — | open seat | — | expired only | — |
| 8 | payment and expiry concurrent | DP1-05 | no double | no double | no double capture | — | locks |
| 9 | duplicate expiry execution | idempotent | unchanged 2nd | unchanged 2nd | unchanged | idempotent outbox | worker twice |
| 10 | partial payment before expiry | approved | partial | hold | remaining > 0 | — | finance+portal |
| 11 | operator extends deadline | approved | unpaid | hold | dueAt moved | audit | operator UI |
| 12 | member cancel before payment | cancelled if 09 | unpaid | release | no refund | cancelled | portal |
| 13 | operator cancellation | cancelled | unpaid/paid branch DP-6 | release | refund if paid | cancelled | operator |
| 14 | tour deadline policy changed after approval | per 01/10 | dueAt frozen or not | — | — | — | — |
| 15 | timezone/DST | instant correct | — | — | — | — | locale display |
| 16 | member refresh/relogin | same dueAt | same | — | — | — | portal |
| 17 | operator/member same dueAt | equal ISO | — | — | — | — | both screens |
| 18 | restart before worker | still expires | — | — | — | — | process restart |
| 19 | delayed worker on already-paid | no expiry | paid | hold | no reverse | skip | — |
| 20 | expired cannot double-promote | one promote | — | no overfill | — | — | waitlist |

### DP-2 (browser)

Operator on one tour: eight questions visible; waitlist member not in “expected” unless 03 says so; driver row identifiable.

### DP-3

One scenario per field class × (no regs / pending only / approved unpaid / paid).

### DP-5

3 offered / 2 carried; passenger cancel; driver cancel; tour cancel; correction.

### DP-6

Member cancel unpaid; operator cancel paid; tour cancel mixed; double-complete refund rejected.

---

## Payment lifecycle state model — proposed options only

**Do not implement until selected.**

```text
Option L1 — Reuse cancelled
  approved+unpaid+dueAt  →  (pay) approved+paid
                         →  (expire) cancelled + release
  Copy risk: “cancelled” vs “expired”

Option L2 — New booking status payment_expired
  Requires booking-http-contracts + DENALI_BOOKING_TRANSITIONS alignment
  approved → payment_expired (terminal or review)

Option L3 — Stay approved + holdExpired flag
  Occupancy still counts unless 02 changes
  Does not fix capacity leak by itself

Option L4 — Dual hold
  approved_unpaid_hold vs approved_paid
  New statuses — largest contract change
```

Finance axis stays `unpaid | partial | paid` unless Finance owner expands.

---

## Final participant semantics — proposed options only

```text
Option F1 — Operational roster = approved (current transport tab)
Option F2 — Commercial confirmed = paid OR waived (remaining = 0)
Option F3 — Third axis operator_confirmed_attending
Option F4 — Attendance (post-tour) separate from pre-departure roster
```

Product may combine F1+F2 as **filters**, not one enum.

---

## Transport settlement model — proposed options only

```text
Facts (always store separately):
  offeredSeats, assignedPassengers, carriedPassengers

Pay basis (DEN-PROD-06): offered | assigned | carried | operator_entered

Payable-at (DEN-PROD-07): allocation | freeze | departure | completion | operator_confirm

Money path:
  Settlement (Denali or finance submodule)
    → Finance credit / manual payout   [MINIMUM]
    → Wallet later via same Settlement ID (no Transport rewrite)
```

---

## Refund model — current + gaps

| Item | Current | Gap |
|------|---------|-----|
| Aggregate | `FinanceRefund` statuses request→approve→complete | None for manual path |
| HTTP | `/finance/refunds*` | None |
| UI | Finance hub refunds panel **on** | Not linked from cancel |
| Cancel | Bookings cancel, no finance call | **MISSING orchestration** |
| Member cancel | Absent | DEN-PROD-09 |
| Penalty | Catalog display only | Not enforced |
| Destination | Operator complete + evidence | DEN-PROD-08 |
| Gateway reverse | N/A | No gateway |
| Wallet credit | N/A | DEN-PROD-05 |

---

## Browser certification matrix

| Surface | 1440 desktop | 768 tablet | 360/390 mobile |
|---------|--------------|------------|----------------|
| Operator wizard / publish / bookings / finance / tour workspace | **Required** for DP-1,2,3,5,6,8 | Risk-based (roster, finance) | Not required |
| Member portal registration list/detail / pay / cancel | **Required** DP-4, DP-8 | Optional | **Required** DP-4, DP-8 |
| Marketing catalog / PDP | DP-8 golden | Optional | Optional (funnel starts here) |

Not every scenario at every width.

**Evidence per journey:** route, role, visible text/state, screenshot, network for mutations, console errors, server errors, inspectable domain/DB row.

**No screenshot-only certification.**

---

## Automated certification policy

| Change type | UNIT | DOMAIN | CONTRACT | INTEGRATION | E2E | BROWSER |
|-------------|------|--------|----------|-------------|-----|---------|
| Copy/i18n | | | | | | yes |
| Pure policy function | yes | yes | | | | |
| Money / capacity / status | | **yes** | **yes** | **yes** | targeted | **yes** |
| Concurrency/race | | yes | | **deterministic yes** | | optional |
| New persistence | | | yes | yes + **cross-tenant negative** | | |
| Projection/roster | | | yes | yes | | yes |

**`[x]` forbidden** without browser/runtime for product-facing DP-1…8.

---

## Runtime evidence policy

If automated **PASS** and browser **FAIL**:

- Task stays `[v]`
- Do **not** weaken tests to hide runtime
- File **RUNTIME_FINDING**: reproduction, screenshot, network, severity, owner
- Fix → automated regression → browser rerun → close

Evidence store: `/opt/cursor/artifacts/` (Cloud) or `docs/dev/evidence/denali-dp/` (committed thumbs + links — no secrets).

---

## Migration / rollback policy

Assume **non-empty** `operator_registrations` and payments.

| Step | Rule |
|------|------|
| Add column | Nullable first; app dual-read |
| Backfill | Explicit job; grandfather `paymentDueAt=null` = **no expiry** unless product says backfill |
| Worker | Off until backfill complete |
| Rollback | Keep column; stop worker; old app ignores null |
| Coexistence | Memory driver + Prisma must share semantics |
| New services | Expand/contract; no break of `approve_then_offline_pay` mid-deploy |

---

## Isolation

New Payment deadline, Settlement, Refund orchestration, Notifications, Roster projections: **tenant_id on every query**. Add cross-workspace negative tests when persistence is added.

---

## Dependency graph

```text
DP-0  Product truth + DEN-PROD gates
  │
  ├─► DP-1  Payment deadline / approved-unpaid     [FINANCIAL_HIGH]
  │     ├─► DP-2  Unified roster (dueAt column)
  │     ├─► DP-4  Member dueAt + expiry copy + notify
  │     └─► DP-6  Expiry vs refund
  │
  ├─► DP-3  Mutation safety (parallel after DP-0; 11 couples Finance)
  │
  ├─► DP-4  also needs 09, 12 (can start copy/inbox design after DP-0)
  │
  ├─► DP-5  Settlement (after 03 passenger set; finance seam; Wallet optional)
  │
  ├─► DP-6  Cancel↔refund (after 08, 09; reuse refunds)
  │
  ├─► DP-7  Post-tour (after roster; settlement/refund as scoped)
  │
  └─► DP-8  Golden cert (after chosen first-customer phases)
```

---

## Pause points

| Pause after | Safe? |
|-------------|-------|
| **DP-0 only** | **YES** — planning/evidence; no money strangler |
| **DP-1 `[x]`** | **YES** — complete hold/expiry loop |
| **DP-1 `[v]` without browser** | **NO** as product complete; OK as engineering checkpoint |
| **dueAt column written, worker off** | **NO** for paid ops (holds never expire) |
| **DP-2 roster** | **YES** if DP-1 done or explicitly out of pilot |
| **MINIMUM PAID OPERATIONS set** (0+1+2+3+4min+6) | **YES** |
| **Halfway occupancy formula change (02)** | **NEVER** |
| **Halfway refund hook (cancel without idempotent refund)** | **NEVER** |

---

## Estimated size

| Phase | Size | Notes |
|-------|------|-------|
| DP-0 | MEDIUM | Workshop + evidence; not code-heavy |
| DP-1 | **LARGE** | Highest **financial** + **concurrency** risk |
| DP-2 | LARGE | Highest **browser-validation** for operators |
| DP-3 | MEDIUM | High money risk if reprice |
| DP-4 | MEDIUM | Channel decision dominates |
| DP-5 | LARGE | Highest financial after DP-1; deferrable |
| DP-6 | MEDIUM | Reuse refunds; orchestration is the work |
| DP-7 | SMALL–MEDIUM | Mostly deferrable |
| DP-8 | LARGE (**validation burden**, not feature count) | |

**Highest financial risk:** DP-1, DP-5, DP-6, DP-3 reprice.  
**Highest concurrency risk:** DP-1 scenarios 3, 8, 9, 20.  
**Highest browser burden:** DP-8, DP-2, DP-4 mobile.

Task count (approx.): DP-0 8 + DP-1 20 + DP-2 12 + DP-3 14 + DP-4 12 + DP-5 16 + DP-6 12 + DP-7 10 + DP-8 10 ≈ **114** ledger rows (many `[!]`).

---

## First implementation slice

**NOT production implementation.**

1. Complete **DP0-01, DP0-04, DP0-06, DP0-07** (evidence freeze + baseline browser of **current** product).
2. **DONE:** DEN-PROD-01, 02, 04, 11 approved — `docs/dev/dp-1-execution-plan.md`. Remaining: **DEN-PROD-05** (Wallet) and other gates.
3. **NEXT:** Write **failing automated tests** per `dp-1-execution-plan.md` § First implementation slice (DP1-A/B/C/D).
4. DP-1 production behavior only after S1 integration tests green.

No Wallet. No settlement. No schema. No jobs. No status changes in this planning run.

---

## Financial safety (applies to later implementation)

- Integer minor units  
- Idempotency keys on payments, refunds, expiry  
- Audit trail  
- No duplicate obligation  
- No duplicate settlement  
- No double refund  
- No accidental negative balance  
- Payment/expiry concurrency  
- Immutable financial evidence where Finance already requires it  

---

## Doc-first reminder (when implementation later touches API)

Before changing `apps/api`, `packages/workspace-sdk`, or `packages/platform-core`: update matching Markdoc under `docs/` (especially `registration-payment-orchestration.mdoc` and booking lifecycle contracts). Booking status expansion (Option L2) is a **platform contract** change.

---

Architect, documentation status: **Updated**. Link to docs: `docs/dev/denali-product-completion-plan.md`.

---

**DENALI-PRODUCT-PLAN READY_FOR_PRODUCT_DECISIONS**
