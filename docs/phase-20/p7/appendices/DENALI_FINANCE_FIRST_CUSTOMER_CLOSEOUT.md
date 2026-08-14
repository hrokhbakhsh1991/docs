# Denali Finance First-Customer Closeout (PR22)

```yaml
doc_id: DENALI_FINANCE_FIRST_CUSTOMER_CLOSEOUT
version: "2026-08-08-v1"
status: CLOSEOUT_GATE
phase: PR22
tenant: "00000000-0000-4000-8000-000000000003"
verdict: READY_FOR_FINANCE_CLOSEOUT
product_code_changes: none
rollout_expand: forbidden
shadow: false
artifacts:
  - /tmp/pr22-closeout.json
  - /tmp/pr22-safety.json
  - /tmp/pr22-observation.json
  - /tmp/pr19-production-health-report.json
  - scripts/pr22-denali-finance-closeout-gate.py
related:
  - docs/phase-20/p7/appendices/DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md
  - docs/phase-20/p7/appendices/DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md
  - docs/phase-20/p7/appendices/FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md
```

## Decision

**`READY_FOR_FINANCE_CLOSEOUT`**

Denali Finance first-customer delivery is **complete**. The agreed first-customer contract remains healthy under a final live operator + SoT smoke, safety boundaries hold, UI ↔ SoT consistency holds, and targeted regressions are green.

This gate did **not** invent features, expand rollout, enable shadow, or modify FinanceService / finance-core / Finance Case / Command Bridge / payment policies.

```text
FIRST CUSTOMER: DENALI
FINANCE STATUS: COMPLETE
CUSTOMER HANDOFF: COMPLETE
PRODUCTION BLOCKERS: 0
CUSTOMER RISKS: 0
NEXT STEP: CUSTOMER-DRIVEN DEVELOPMENT
```

**Explicit statement:** Denali Finance first-customer delivery is complete.

---

## Phase 1 — Architecture verification (unchanged)

| Authority | Confirmed role |
| --------- | -------------- |
| **FinanceService** | Mutation authority — `createManualPayment`, receipt submit/review, booking payment sync |
| **Finance Case** | Commercial interpretation / Meaning only — no SoT mutation, no Case persistence |
| **Command Bridge** | Intent + authorization boundary; delegates mutation via FinanceService adapter |
| **Host/adapters** | Fact mapping for Encounter reads |
| **Denali** | First customer / workspace |

### Rollout (fail-closed, unchanged)

| Flag | Value |
| ---- | ----- |
| `FINANCE_CASE_ENCOUNTER_MODE` | `internal` |
| `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` | `…000003` only |
| `FINANCE_CASE_SHADOW_ENABLED` | `false` |
| `FINANCE_CASE_COMMAND_UI_ENABLED` | `true` (web) |
| `FINANCE_CASE_COMMAND_UI_TENANT` | `…000003` only |
| `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE` | `false` |

No silent flag changes. No additional tenants/commands. No public Encounter. No shadow.

---

## Phase 2 — Final live Denali smoke

**Registration (clean):** `d6794466-ce06-4da1-b09a-eff8a0bd0baa`

| Step | Result |
| ---- | ------ |
| Manual payment create | **201** `Pending` |
| Receipt upload → submit → pending queue | **PASS** |
| Approve underpay | booking **`partial`**, remaining **`1000000`** |
| Mid collection | booking **`partial`**, remaining **`500000`** |
| Final settlement | booking **`paid`**, remaining **`0`** |
| UI ↔ SoT | 3 Paid payments + paid + rem 0 |

Intermediate states were verified after each payment (not only final).

Reject lane (separate clean registration): receipt **Rejected**, booking remains **unpaid**.

---

## Phase 3 — Failure safety

| Scenario | HTTP / outcome | SoT |
| -------- | -------------- | --- |
| Overpay | **422** `FINANCE_OBLIGATION_OVERPAY` | no payment row; unpaid |
| Duplicate after paid | **400** | remains paid, rem 0 |
| Unauthorized | **401** | no mutation |
| Stale Command | **409** fail-closed | no second write |
| Cross-tenant (urban host) | **401** | fail closed |
| Reject | **200** Rejected | booking unpaid |

---

## Phase 4 — UI ↔ SoT consistency

No BLOCKER/CUSTOMER_RISK discrepancies observed:

- Payments list matches Paid count after settlement
- Booking payment status matches remaining
- Receipt Approved/Rejected matches review decision
- Command failures do not claim success

---

## Phase 5 — Commercial Meaning

- GET/read only; load **200** with `executionId`
- Refresh changes `executionId`
- No SoT mutation from Meaning reads
- No CaseOutput / interpreter leakage in Encounter payload (static leak scan clean)

---

## Phase 6 — Command UI (`reviewReceipt` only)

- Capability discovery present on Encounter
- Stale submit → **409** (no second mutation); classic review still works
- No new command types; no capture/refund/settlement/bulk/auto

---

## Phase 7 — Operator experience (non-blocking)

| Finding | Class |
| ------- | ----- |
| Overview may still reference prepay/installments while tabs hidden | **UX_IMPROVEMENT** |
| Stale Command may return `CASE_COMMAND_VOCABULARY_DENIED` at 409 (not `CASE_COMMAND_STALE`) | **UX_IMPROVEMENT** |
| open-payments / prepayments / installments out of first-customer scope | **DOCUMENTATION** |

UX confusion was **not** elevated to BLOCKER/CUSTOMER_RISK — core payment/receipt/settlement operation is not prevented.

---

## Phase 8 — Production observation

### Controlled closeout smoke window (`/tmp/pr22-observation.json`)

| Metric | Value |
| ------ | ----- |
| Source | controlled_closeout_smoke_window |
| Request count | **126** |
| Availability | **1.0** |
| Latency p50 / p95 / p99 (ms) | **89.9 / 2095.6 / 5889.5** |
| Auth failures (expected 401 probe) | 1 |
| SoT mutation failures in smoke | **0** |
| Production traffic volume | **INSUFFICIENT_SAMPLE** |
| Command success/failure rate | **INSUFFICIENT_SAMPLE** |
| Stale rate | **INSUFFICIENT_SAMPLE** |
| Provider degradation | **INSUFFICIENT_SAMPLE** |
| Incomplete / exception / Meaning timeout rates | **INSUFFICIENT_SAMPLE** |
| Operator return-to-operational-view | **INSUFFICIENT_SAMPLE** |

### Existing tooling

- `scripts/pr19-denali-controlled-production-observation.sh` → **PASS** (`/tmp/pr19-production-health-report.json`)
- `scripts/pr20-denali-controlled-command-usage.sh` → fixture seed fail on exhausted unpaid inventory (**not** a product regression; closeout smoke already exercised command safety)

**Interpretation:** Delivery closeout does **not** require fabricating production confidence. Sustained real-customer volume remains **INSUFFICIENT_SAMPLE** and continues as **operational monitoring**, not as an open architecture PR track.

---

## Phase 9 — Known non-blockers (re-evaluated)

| Item | Decision |
| ---- | -------- |
| Overview prepay/installments copy + overdue KPI | Keep as **UX_IMPROVEMENT** — does not block first-customer ops |
| Stale code `CASE_COMMAND_VOCABULARY_DENIED` @ 409 | Keep as **UX_IMPROVEMENT** — fail-closed preserved |
| open-payments BFF 404 | Out of scope — **DOCUMENTATION** |
| prepayments / installments | Out of scope — **DOCUMENTATION** |

No auto-fixes applied.

---

## Phase 10 — Regression gate (targeted)

| Suite | Result |
| ----- | ------ |
| Command Bridge architecture / production / bridge / UI validation | **32/32 pass** |
| `error-interceptor` overpay → 422 | **pass** |
| booking payment status + paid/remaining coherence | **pass** |
| controlled production + command usage specs | **pass** |
| finance-core debt policy + balance→status | **10/10 pass** |
| platform Denali first-customer exit | **9/9 pass** |
| Live closeout smoke | **45 PASS / 0 FAIL** |

No tests weakened. Full monorepo gates were **not** run (Development Speed Protocol).

---

## 1. Final Denali Finance acceptance report

First-customer Finance is accepted for Denali on the controlled internal tenant with:

- **0 BLOCKER**
- **0 CUSTOMER_RISK**
- Core journey proven live (manual payment → receipt → review → partial → settlement)
- Safety boundaries proven
- Authority model preserved

---

## 2. Exact first-customer capability list

**In scope**

- Finance Command Center
- Payments / receipts / manual payment
- Receipt upload, retrieve, submit, approve, reject
- Partial collection and final settlement (`remaining = 0`)
- Booking payment synchronization
- Ledger / report visibility used by Denali UI
- Commercial Meaning (read)
- Narrow `reviewReceipt` Command UI

**Out of scope (closed)**

- Prepayments, installments, open-payments route
- Online capture, refunds, bulk/automatic actions
- Additional Command Bridge commands
- Multi-tenant Command UI expansion
- Public/default Encounter, shadow rollout, automatic flag changes

---

## 3. Proven workflows

1. Manual payment create → Pending on registration  
2. Receipt upload → submit → pending review  
3. Approve underpay → `partial` + remaining decreases  
4. Additional payments → remaining decreases stepwise  
5. Final approve → `paid` + remaining `0`  
6. Reject → booking unpaid  
7. Meaning load + refresh  
8. Classic review + Command stale fail-closed  

---

## 4. Safety guarantees

- Overpay controlled **422**; no false financial state  
- Duplicate after settlement controlled **4xx**; no second successful debt  
- Unauthorized **401**; no mutation  
- Stale Command **409**; no second mutation  
- Cross-tenant fail closed  
- FinanceService remains mutation authority  
- Case remains interpretation/read authority  
- No Case persistence; no unauthorized mutation  

---

## 5. Known limitations

1. Prepayments / installments not first-customer accepted (tabs hidden).  
2. `GET /api/finance/reports/open-payments` BFF **404**.  
3. Rejected receipts may leave **Pending** payment rows (reuse path).  
4. Stale Command public code may be vocabulary-denied while still **409**.  
5. Encounter / Command UI remain **single-tenant internal** allowlist.  
6. Production traffic observation volume: **INSUFFICIENT_SAMPLE**.  

---

## 6. Non-blocking UX / documentation backlog

1. Clarify Overview copy/KPI so it does not advertise hidden prepay/installment tabs.  
2. Optional: normalize stale Command public code to `CASE_COMMAND_STALE`.  
3. Operator runbook: explicit out-of-scope list (open-payments / prepay / installments).  

---

## 7. Rollback procedure

1. Do **not** auto-flip Encounter/Command flags.  
2. Disable Command UI (`FINANCE_CASE_COMMAND_UI_ENABLED=false` or remove tenant) — classic `PATCH …/receipts/:id/review` remains.  
3. Keep `FINANCE_CASE_SHADOW_ENABLED=false`.  
4. If SoT is wrong: fix FinanceService/host with doc-first; **never** patch via Case.  
5. Reconstruct via receipt review + ledger/outbox audit trail.  

---

## 8. Operational monitoring checklist

- [ ] Meaning availability / timeout / incomplete (existing Encounter telemetry)  
- [ ] Command submit success vs fail vs stale (409)  
- [ ] Auth failures on finance routes  
- [ ] Provider degradation signals (fail-open)  
- [ ] SoT mutation failures (422/4xx rates on create/review)  
- [ ] Operator return-to-operational-view (client feedback counters)  
- [ ] Re-run `scripts/pr19-denali-controlled-production-observation.sh` on a schedule during early ops  
- [ ] Treat **INSUFFICIENT_SAMPLE** honestly until real volume exists — do not invent confidence  

---

## 9. Recommended next development phase

**CUSTOMER-DRIVEN DEVELOPMENT only.**

Future Finance work must be driven by:

1. Real Denali/customer requirements, **or**  
2. Observed production problems with evidence, **or**  
3. Explicitly approved product roadmap items  

Do **not**:

- Invent follow-on PRs merely to enlarge architecture  
- Reopen closed scopes (prepay/installments/open-payments/shadow/multi-tenant Command) without new evidence  
- Move mutation into Case or bypass FinanceService  

Optional polish (non-gate): Overview scope language; stale Command error code naming.

---

## 10. Closeout statement

> Denali Finance first-customer delivery is complete.

Prior gates preserved:

- Product acceptance: `READY_FOR_FIRST_CUSTOMER`  
- Customer handoff: `READY_FOR_CUSTOMER_HANDOFF`  
- This closeout: `READY_FOR_FINANCE_CLOSEOUT`  

---

## Evidence

| Artifact | Path |
| -------- | ---- |
| Closeout machine report | `/tmp/pr22-closeout.json` |
| Safety extract | `/tmp/pr22-safety.json` |
| Observation summary | `/tmp/pr22-observation.json` |
| Gate script | `scripts/pr22-denali-finance-closeout-gate.py` |
| PR19 health | `/tmp/pr19-production-health-report.json` |
| Handoff predecessor | `DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md` |
