# Denali Finance Customer Handoff Gate (PR21-A)

```yaml
doc_id: DENALI_FINANCE_CUSTOMER_HANDOFF_GATE
version: "2026-08-08-v1"
status: HANDOFF_GATE
phase: PR21-A
tenant: "00000000-0000-4000-8000-000000000003"
verdict: READY_FOR_CUSTOMER_HANDOFF
artifacts:
  - /tmp/pr21a-handoff.json
  - /tmp/pr21a-safety.json
  - scripts/pr21a-denali-customer-handoff-gate.py
related:
  - docs/phase-20/p7/appendices/DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md
  - docs/phase-20/p7/appendices/FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md
locks:
  product_code_changes: none_in_this_pr
  rollout_expand: forbidden
  shadow: false
```

## Decision

**`READY_FOR_CUSTOMER_HANDOFF`**

Denali operators can safely run the **agreed first-customer Finance contract** on the controlled internal tenant. No BLOCKER and no material CUSTOMER_RISK remain after operator-facing + SoT validation.

This gate did **not** change FinanceService, finance-core, Case, Command Bridge, or rollout flags.

---

## Environment

| Item | Value |
| ---- | ----- |
| Tenant | `00000000-0000-4000-8000-000000000003` |
| Web | `http://denali.admin.localhost:3000` |
| API | `http://127.0.0.1:3001` |
| Encounter | `FINANCE_CASE_ENCOUNTER_MODE=internal` |
| Command UI | enabled for tenant `…000003` only |
| Shadow | `false` |

---

## First-customer contract (in scope)

- Finance Command Center
- payments / receipts / manual payment
- receipt upload → submit → pending → approve/reject
- partial collection through remaining = 0
- booking payment sync
- ledger/report views used by the UI
- Commercial Meaning (read)
- narrow `reviewReceipt` Command UI

**Out of scope (accepted):** prepayments, installments, `open-payments` BFF, capture/refund, bulk/auto actions, new commands.

---

## Operator acceptance matrix (summary)

Full step table: `/tmp/pr21a-handoff.json` (`steps[]`).

| Area | Expected | Actual | Status |
| ---- | -------- | ------ | ------ |
| `/finance` hub | Loads; Denali tenant | 200; Persian Command Center; Operational + Meaning toggles | **PASS** |
| Tabs | payments / receipts / ledger | Present; prepay/installment **tabs** hidden | **PASS** |
| Reports | summary / ledger-events / by-tour | 200 | **PASS** |
| Manual payment | Create Pending on registration | 201; listed under registration | **PASS** |
| Receipt lifecycle | upload → submit → pending → URL | All 200/201 | **PASS** |
| Approve underpay | booking `partial`, remaining &gt; 0 | remaining `1000000` | **PASS** |
| Mid collection | still `partial`, remaining decreases | `1000000` → `500000` | **PASS** |
| Final collection | `paid`, remaining `0` | proven on `6ec56141-…` | **PASS** |
| UI ↔ SoT | 3 Paid payments + paid + rem 0 | consistent | **PASS** |
| Meaning | load + refresh new executionId; no SoT mutate | PASS | **PASS** |
| Overpay | 422, no mutation | exceed-remaining 422 | **PASS** |
| Reject | booking unpaid | Rejected + unpaid | **PASS** |
| Duplicate after paid | 4xx | 400 | **PASS** |
| Unauthorized | 401 | 401 | **PASS** |
| Stale Command | 409 fail-closed | 409; no second write | **PASS** |
| Cross-tenant | fail closed | urban host 401 | **PASS** |
| Browser payments UI | manual form + list | `/finance?tab=payments` | **PASS** |

Primary journey registration: `6ec56141-0734-4210-9115-410b528a81bc` (fresh approved unpaid → multi-pay to paid).

---

## Findings

| Class | Count | Notes |
| ----- | ----- | ----- |
| BLOCKER | **0** | — |
| CUSTOMER_RISK | **0** | — |
| UX_IMPROVEMENT | 2 | Overview still mentions prepay/installments + overdue-installments KPI; stale error code is `CASE_COMMAND_VOCABULARY_DENIED` not `CASE_COMMAND_STALE` |
| DOCUMENTATION | 1 | Ship operator checklist with explicit scope |
| NON_BLOCKING | 0 | — |

Hard rule honored: UX improvements were **not** elevated to blockers.

---

## Customer-facing Finance capability summary

Denali Finance (first customer) lets operators:

1. Open **امور مالی** and work from Payments / Receipts / Ledger.
2. Create a **manual payment** against an approved booking.
3. Upload and submit a **receipt**, then approve or reject it.
4. Collect in **multiple payments** until remaining balance is **0** and booking is **paid**.
5. Read **Commercial Meaning** for attention/lifecycle without mutating money.
6. Use **Command UI reviewReceipt** only where capability allows; stale intents fail closed.

Money authority remains **FinanceService / SoT**. Case/Meaning never write finance state.

---

## Operator acceptance checklist

- [ ] Log in as Denali admin/owner on `denali.admin.localhost`
- [ ] Open `/finance` — see Overview / Payments / Receipts / Ledger
- [ ] Create manual payment for an approved unpaid booking
- [ ] Upload + submit receipt; see it under Receipts pending
- [ ] Approve underpay → booking **partial**, remaining &gt; 0
- [ ] Collect remaining (one or more payments) → booking **paid**, remaining **0**
- [ ] Reject a receipt on a separate booking → booking stays unpaid
- [ ] Confirm over-amount create returns controlled error (not success)
- [ ] Open Commercial Meaning → loads; refresh changes executionId
- [ ] Do **not** rely on Prepayments / Installments / open-payments for go-live

---

## Known limitations

1. **Prepayments / installments** — implemented elsewhere but **not** first-customer accepted; tabs hidden; overview copy/KPI may still mention them.
2. **`GET /api/finance/reports/open-payments`** — BFF 404; unused by UI.
3. **Rejected receipts leave Pending payment rows** — operator reuses that payment for a new receipt rather than creating a second debt intent (by design of Pending gate).
4. **Stale Command error code** may be vocabulary-denied after classic mutate; still **409** with no second write.
5. Controlled **single-tenant** Command UI / Encounter internal allowlist only.

---

## Rollback / safety procedure

If Finance misbehaves in production use:

1. **Do not** flip Encounter/Command flags automatically.
2. Disable Command UI for the tenant (`FINANCE_CASE_COMMAND_UI_ENABLED=false` or remove tenant from allowlist) — classic receipt review remains.
3. Keep `FINANCE_CASE_SHADOW_ENABLED=false`.
4. FinanceService remains sole mutation path — if SoT is wrong, fix via finance-core/host with doc-first; do not patch via Case.
5. Preserve audit: receipt review + ledger outbox events are the reconstruction trail.

---

## Recommended next development phase

Only after this handoff is accepted by Denali ops:

1. Operator runbook polish (scope language; hide/clarify overdue-installments KPI).
2. Optional: normalize stale Command public code to `CASE_COMMAND_STALE`.
3. Separate PR if Denali later requests **prepayments** or **installments** as a contracted feature (live proof required).
4. Do **not** expand Command tenants or enable shadow without a new gate.

---

## Evidence paths

- Machine-readable: `/tmp/pr21a-handoff.json`, `/tmp/pr21a-safety.json`
- Script: `scripts/pr21a-denali-customer-handoff-gate.py`
- Prior product readiness: `DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md` (`READY_FOR_FIRST_CUSTOMER`)
- **Closeout (PR22):** [`DENALI_FINANCE_FIRST_CUSTOMER_CLOSEOUT.md`](./DENALI_FINANCE_FIRST_CUSTOMER_CLOSEOUT.md) — `READY_FOR_FINANCE_CLOSEOUT`
