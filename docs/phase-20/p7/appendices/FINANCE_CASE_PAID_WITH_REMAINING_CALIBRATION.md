# Finance Case Paid-with-Remaining Calibration (PR15-G)

```yaml
doc_id: FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION
version: "2026-08-07-v1"
status: CALIBRATION
phase: PR15-G
pilot_sample: "00000000-0000-4000-8000-000000000523"
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - apps/api/src/workspace-finance/case/host-denali-case-read-source.ts
  - packages/workspaces/denali/src/finance/case-read/map-payment-facts.ts
  - packages/workspaces/denali/src/finance/case-read/map-obligation-facts.ts
locks:
  finance-core_interpreter: unchanged
  partial_scope_fabrication: forbidden
  rollout_expand: forbidden
  shadow: false
  command_ui: false
```

## Purpose

Calibrate ownership of the PR15-F residual (`…0523`): booking `paymentStatus=paid` + settlement `captured` + remaining `900000` → interpreter `no_rule_matched` / `INCOMPLETE_INSPECT`.

Do **not** change finance-core laws, invent partial-scope flags, add UI workarounds, expand rollout, or enable shadow.

---

## Live SoT probe (`…0523`)

| Layer | Value |
| ----- | ----- |
| Tour obligation | `2500000` IRR (`data.pricing.basePricePerPerson` × partySize 1) |
| Paid payments sum | `1600000` (one Manual payment `Paid`) |
| Invoice `balanceDueMinor` | `900000` (compileRegistrationInvoice) |
| Booking `paymentStatus` | **`paid`** (set by classic receipt-approve workflow) |
| Receipt | `Approved` |
| Host `partialScopeDeclared` | hardcoded `false` |
| Case settlement map | booking `paid` → `captured` |
| Case remaining map | invoice balance → `900000` |
| Interpreter | no reading rule matches → `INCOMPLETE_INSPECT` |

Commercial truth: **underpaid relative to tour obligation**, while booking projection claims paid after receipt approval.

---

## Source ownership

| Fact | Owner | Current Denali/Host path |
| ---- | ----- | ------------------------ |
| **Remaining amount** | Finance invoice compile (FinanceService / `compileRegistrationInvoice`) via Host | `HostDenaliCaseReadSource.readObligation` → `getRegistrationInvoiceFacts` + obligationMinor → `remainingMinor` → `mapDenaliObligationToMoneyFacts` |
| **Partial payment declaration** | Workspace commercial policy / operator declaration (Denali has **no** partial-plan SoT today) | Host hardcodes `partialScopeDeclared: false` → mapper `knownFact(false)` — **not** derived from balance |
| **Settlement completeness** | Booking payment projection (`booking.paymentStatus`) today | `readPayment` → `bookingPaymentStatus` → `mapDenaliPaymentToPaymentFacts` (`paid`→`captured`, `partial`/`unpaid`→`unsettled`) |

### Authority notes

- **Remaining** is the commercial balance authority for Case money facts.
- **Booking `paid`** is a **workflow projection** (receipt approve / payment sync), not proof that obligation is zero.
- **`partialScopeDeclared`** must only be `true` when an explicit partial-plan SoT exists — never inferred from remaining alone (no fabrication).
- **Settlement `captured`** from booking `paid` alone can **lie** relative to invoice remaining — Case Host must surface that disagreement.

```text
Tour pricing ──► obligationMinor ──┐
                                   ├─► compileRegistrationInvoice ──► remainingMinor (money)
Payment rows ──► paidPaymentsMinor ┘

Receipt approve ──► booking.paymentStatus=paid ──► settlementMeaning=captured

                    remaining > 0  +  captured  = meaning conflict (Host must declare)
```

---

## Classification (`…0523`)

| Hypothesis | Verdict |
| ---------- | ------- |
| Adapter missing fact | **Yes (Case-facing)** — Host never sets `meaningConflictProven` when booking `paid` contradicts positive invoice remaining; settlement still projected as `captured` |
| SoT data inconsistency | **Yes (root commercial)** — classic workflow marks booking `paid` on receipt approve even when paid sum (`1600000`) &lt; obligation (`2500000`) |
| Unsupported business state needing new Case reading | **No new reading required** — portable category already exists: `exceptionCues.meaningConflict` → conflict code `meaning_conflict` → reading **`EXCEPTION`** |
| Interpreter bug | **No** — `SETTLED_CAPTURED` correctly requires non-positive remaining; without conflict cue, `no_rule_matched` is fail-closed |

**Primary Case fix ownership:** Host Denali Case-read coherence (adapter), not finance-core interpreter mutation.

**Separate FinanceService concern (out of PR15-G Case scope):** whether receipt approve should set booking `partial` vs `paid` when balance remains — SoT write policy; do not silently rewrite SoT from Case.

**PR20-B confirmation:** that SoT concern is now the **expansion blocker**. Evidence + decision: [`FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md`](./FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md) — **KEEP_CASE** + **CHANGE_SOT_POLICY**; rollout **HOLD** until SoT correction.

---

## Minimal Host / Denali mapping fix (implemented)

### Chosen

In `HostDenaliCaseReadSource.readLifecycle`:

1. Resolve the same invoice remaining used by `readObligation`.
2. When `booking.paymentStatus === "paid"` **and** remaining is a known positive minor → set `meaningConflictProven: true`.
3. Mapper already maps that to `exceptionCues.meaningConflict = known(true)` → interpreter `EXCEPTION` (existing law).

### Explicitly not chosen

| Anti-pattern | Why rejected |
| ------------ | ------------ |
| Set `partialScopeDeclared: true` from remaining | Fabricates partial plan; unlocks `PARTIAL_SCOPED` falsely |
| Force `remaining = 0` because booking paid | Invents money; hides underpayment |
| Change finance-core to treat captured+remaining as SETTLED | Blinds operator to commercial gap |
| UI label workaround | Forbidden |
| Expand pilot / shadow / command UI | Forbidden |

### Optional follow-up (not required for PR15-G)

- Case-facing settlement: when conflict detected, emit `settlementMeaning` **unknown** (`booking_paid_with_invoice_remaining`) instead of `captured` — stronger honesty; `EXCEPTION` already wins with meaningConflict alone.
- FinanceService: on approve, set booking `paymentStatus` to `partial` when invoice balance &gt; 0 (SoT write fix; separate PR).

---

## Portable category (existing)

| Cue | Conflict code | Reading |
| --- | ------------- | ------- |
| `exceptionCues.meaningConflict = true` | `meaning_conflict` | `EXCEPTION` |

Use this for **booking-paid vs invoice-remaining** disagreement. Do not invent a new CaseReading in PR15-G.

---

## Regression scenarios (mapper / Host)

| # | Scenario | Expected Case facts | Expected reading (interpreter unchanged) |
| - | -------- | ------------------- | ---------------------------------------- |
| A | Fully paid | remaining `0`, booking `paid` → captured, meaningConflict false | `SETTLED_CAPTURED` |
| B | Partially paid (declared) | remaining &gt; 0, `partialScopeDeclared` true, unsettled | `PARTIAL_SCOPED` |
| C | Paid with outstanding obligation | remaining &gt; 0, booking paid → captured, **meaningConflict true** | `EXCEPTION` |
| D | Inconsistent payment state (same as C) | same conflict cue | `EXCEPTION` (not `INCOMPLETE_INSPECT`) |

Proofs live in Denali case-read mapper specs + Host coherence helper tests. Same facts → same CaseOutput; no finance-core edits.

---

## Recommendation

**CONTINUE** pilot after Host meaning-conflict coherence lands. Treat FinanceService booking `paid`-on-approve underpayment as a **tracked SoT follow-up**, not a Case interpreter change.

### Live after Host fix (`…0523`)

| Field | Value |
| ----- | ----- |
| `meaningConflictProven` | `true` |
| Reading | **`EXCEPTION`** |
| Completeness | `escalate_forced` |
| Posture / owner | `escalate` / `exception_policy` |
| Settlement fact | still `captured` (honest booking projection) |
| Remaining | still `900000` (honest invoice) |

Not READY_FOR_INTERNAL solely on this PR until FinanceService booking status policy for underpayment is reviewed (optional SoT write follow-up).
