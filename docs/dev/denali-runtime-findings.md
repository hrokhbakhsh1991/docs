# Denali runtime findings (DRF)

```yaml
registry_id: DENALI-RUNTIME-FINDINGS-2026-08-24
authority: docs/dev/production-closure-ledger.md
reconciled_commit: ba7b37fa3075fc09651b7d66b47d6e3550d3425e
wave_b_evidence: docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/
```

Runtime closure gaps discovered during **truth reconciliation** and prior DP certification. Product code changes are **out of scope** for Wave A.

Severity: **P0** blocks paid-ops / go-live honesty · **P1** should close before first customer · **P2** hygiene

---

## DRF-001 — Postgres member receipt upload (`RECEIPT_UPLOAD_FAILED` / HTTP 500)

| Field | Value |
|-------|-------|
| **Phase** | Receipt upload (P6 / DP-1 member path) |
| **Severity** | P1 |
| **Role** | Member |
| **Status** | **CLOSED** @ `7628fcd9` memory driver — root cause `MINIO_NOT_CONFIGURED`; fix: dev memory receipt store in `receipt-proof-storage.ts` |
| **Reproduction** | Wave B: multipart upload 201 + paid booking; evidence `upload-receipt-e2e.json` |
| **Required rerun** | Postgres path still **NEEDS_VERIFICATION** (B8 BLOCKED_EXTERNAL) |

---

## DRF-002 — DP-2 browser certification marker reverted without retained artifacts

| Field | Value |
|-------|-------|
| **Phase** | DP-2 |
| **Severity** | P1 |
| **Role** | Operator |
| **Status** | **CLOSED** @ `7628fcd9` |
| **Evidence** | `docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/browser/dp2-roster-1440.png` |

---

## DRF-003 — Master product ledger stale vs implementation (DOC)

| Field | Value |
|-------|-------|
| **Phase** | DP-4 / DP-5 / DP-6 ledger rows |
| **Severity** | P0 (process) |
| **Status** | **CLOSED** @ reconciliation commit |
| **Fix** | `production-closure-ledger.md` created; `denali-product-completion-plan.md` synced |

---

## DRF-004 — Missing `denali-product-completeness-audit.md` (DOC)

| Field | Value |
|-------|-------|
| **Severity** | P1 (process) |
| **Status** | **OPEN** — superseded for closure by production-closure-ledger + updated completion plan |
| **Note** | Do not resurrect stale audit claims; cite finance acceptance audit for pre-DP finance baseline |

---

## DRF-005 — DP certification scripts not reproduced in unbuilt reconciliation checkout

| Field | Value |
|-------|-------|
| **Phase** | DP-1..6 automated gates |
| **Severity** | P1 (environment) |
| **Status** | **CLOSED** @ `7628fcd9` — B1 + `denali-wave-b-runtime-cert.sh` PASS |

---

## DRF-006 — Payment expiry live replay not browser-certified

| Field | Value |
|-------|-------|
| **Phase** | DP-1 |
| **Severity** | P0 (closure) |
| **Role** | Operator, Member |
| **Status** | **CLOSED** @ `7628fcd9` |
| **Evidence** | Live `POST /finance/payment-holds/:id/extend` + scheduler tick; `dp1-c-after-expiry.json`, `dp1-d-promoted.json` |

---

## DRF-007 — DEN-PROD-03 final participant semantics unsigned vs code PROPOSED rule

| Field | Value |
|-------|-------|
| **Phase** | DP-2 / roster |
| **Severity** | P1 (product) |
| **Status** | **CLOSED** @ Wave B 2026-08-24 — DEN-PROD-03 APPROVED; code parity confirmed |
| **Rule in code** | `final := approved && remainingMinor === 0` (waived counts settled) |
| **Evidence** | `docs/dev/production-closure-ledger.md` § DEN-PROD-03 decision lock |

---

## Closed historical remediation (DPR — do not reopen)

| ID | Summary | Closed @ |
|----|---------|----------|
| DPR-001 | Stale finance-core dist / quote cache | `9bbf358e` |
| DPR-002 | Tour canonical ignored for policy hours | `9bbf358e` |
| DPR-003 | Auto-approve skipped payment hold | `9bbf358e` |
| DPR-004 | Expiry scheduler not bootstrapped | `9bbf358e` |
| DPR-005 | DP-1 gate script exit 0 on failure | `9bbf358e` |
| DPR-006 | Import boundary deep denali import | `9bbf358e` |

Detail: `docs/dev/dp-1-execution-plan.md` § DPR remediation closure.

---

Architect, documentation status: **Updated**. Link to docs: `docs/dev/denali-runtime-findings.md`.
