# Final hostile enterprise finance certification (re-score v3)

```yaml
cert_id: FINANCE_HOSTILE_CERTIFICATION_FINAL
version: "3.0"
date: "2026-07-19"
compares_to: FINANCE_HOSTILE_CERTIFICATION_FINAL_V2 (composite 65)
method: hostile re-score after P0 remediations + recon foundation
delta_inputs:
  - FINANCE_RECEIPT_SUBMIT_OWNERSHIP_REMEDIATION.md
  - FINANCE_LEDGER_CORRECTNESS_REMEDIATION.md
  - FINANCE_DUPLICATE_CREDIT_REMEDIATION.md
  - FINANCE_RECONCILIATION_FOUNDATION.md
  - FINANCE_HOSTILE_AUTHORIZATION.md (v1.1 mitigated IDOR)
  - FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md (durable path PASS)
  - code: submitReceipt ownership, FINANCE_LEDGER_CAPTURE_EMPTY, advisory XOR credit, recon/*
```

## Score change vs v2.0

| Dimension | v2.0 | v3.0 | Δ | Why |
| --------- | ---: | ---: | -- | --- |
| **Architecture** | 73 | **75** | +2 | Recon module lives in host/outbox boundaries; no SM / ledger-ID / approve-TX churn |
| **Correctness** | 63 | **82** | **+19** | Empty-lines fail-closed; prepay enqueue checked; Path A XOR B wallet credit |
| **Security** | 58 | **78** | **+20** | Member `POST /finance/receipts` ownership gate (`BOOKINGS_FORBIDDEN`) |
| **Operations** | 56 | **68** | **+12** | Recon jobs + findings + allowlisted repair + audit; prod replay / formal SLOs still open |
| **Maintainability** | 76 | **79** | +3 | Remediation docs + proof specs + recon foundation catalog |

**Composite:** **65 → 76 / 100** (**+11**)

```text
P0 money integrity + IDOR cleared. Ops moved on recon implement.
Enterprise still blocked on prod replay, formal SLOs, and incomplete repair allowlist.
```

---

## Classification

| Label | v2.0 | v3.0 |
| ----- | ---- | ---- |
| Prototype | No | No |
| Product | Partial | **Yes** |
| **Platform** | **Yes** | **Yes** |
| Enterprise Platform | No | **No** |

**Final classification: Platform** (product money path certified for internal reuse; not enterprise-certified).

---

## P0 / P1 verification

| ID | Claim | Verdict | Evidence |
| -- | ----- | ------- | -------- |
| **P0** Receipt authorization | Member cannot submit for another’s payment | **PASS** | `FinanceService.submitReceipt` → `memberOwnsRegistration`; AUTHZ-RECEIPT + ownership remediation |
| **P0** Ledger durability | Paid/Approved cannot commit without capture | **PASS** | `FINANCE_LEDGER_CAPTURE_EMPTY`; Prisma requires non-empty capture; prepay `!inserted` → conflict |
| **P0** Duplicate credit prevention | TourCreated ∩ capture ≤ one wallet credit | **PASS** | `pg_advisory_xact_lock` + `registrationHasBookingWalletCredit`; Path B skip / Path A throw |
| **P1** Reconciliation | Jobs + findings + repair | **PARTIAL** | Foundation shipped (R1–R6 detect; apply for paid-no-ledger + booking drift); prepay/outbox repair detect-only |
| **P1** Replay | Prod-gated outbox replay (DEC-086) | **FAIL** | `replayFailedOutboxEvent` still `assertProvisioningDevelopmentOnly()` |
| **P1** SLO | Written numeric SLOs + dashboard | **FAIL** | Alerts/runbook exist; no error-budget / finance SRE SLO pack |

---

## Questions

| # | Question | Verdict | vs v2.0 |
| - | -------- | ------- | ------- |
| 1 | Ready for **enterprise production**? | **NO** | Unchanged (P1 replay/SLO) |
| 2 | Ready for **10 concurrent workspace deployments**? | **CONDITIONAL** — plugin host YES; **product parity FAIL** (`FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md`) | Re-verified hostile multi-product |
| 3 | Ready for **internal platform reuse**? | **YES** | Unchanged |
| 4 | **Extraction still unnecessary**? | **YES** | Unchanged |

---

## Remaining blockers (enterprise only)

### P1

1. **Prod-gated outbox replay** — DEC-086 still non-prod (`assertProvisioningDevelopmentOnly`).
2. **Written numeric SLOs + SRE dashboard** — alerts exist; error-budget SLOs missing.
3. **Recon repair completeness** — prepay ledger / degraded / outbox-failed apply + prod dual-control on `dryRun:false`.

### P1/P2

4. ~~**Unstable adapter `domainEventId`**~~ — **remediated** (`FINANCE_ADAPTER_IDENTITY_STABILITY.md`: fail-closed stable ids + host assert).
5. **Per-workspace product/ops parity** — **FAIL** on hostile multi-product cert (ops only denali+ws5; workflows Denali-only; IRR UI leftovers). See `FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md`.

### Extraction

6. Still unnecessary.

---

## One-line cert (v3.0)

**Internal Platform + Product money path: certified (+11). Enterprise Platform: not certified — prod replay + formal SLOs + incomplete recon repair remain.**
