# Denali runtime findings (DRF)

```yaml
registry_id: DENALI-RUNTIME-FINDINGS-2026-08-24
authority: docs/dev/production-closure-ledger.md
reconciled_commit: 09ba2b09906fde8d7104489fa8401ef4d9ab2e99
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
| **Status** | **NEEDS_VERIFICATION** on `main` + Postgres |
| **Source** | `docs/phase-20/p7/runbooks/p7-staging-e2e.md` — SMK-PTL-04 symptom table |
| **Hypothesis** | `STORAGE_DRIVER=prisma`: booking lookup without admin/RLS path returns null before finance write |
| **Reproduction** | Member `POST` receipt on approved registration against Postgres API (not memory driver) |
| **Evidence** | Historical staging notes only — **not reproduced** in reconciliation VM (no Postgres) |
| **Required rerun** | `SMK-PTL-04` or `p6-member-receipt-flow.spec.ts` on Postgres after `db:migrate:deploy` |

---

## DRF-002 — DP-2 browser certification marker reverted without retained artifacts

| Field | Value |
|-------|-------|
| **Phase** | DP-2 |
| **Severity** | P1 |
| **Role** | Operator |
| **Status** | **OPEN** |
| **Source** | `6431af73` marked DP2-11/12 `[x]`; `9126e966` reverted to `[!]` |
| **Evidence** | `scripts/seed-dp2-physical-cert-fixture.mjs` expects `/opt/cursor/artifacts/dp2-cert-*` — **no files** on `main` or reconciliation artifact store |
| **Required rerun** | Operator 1440 roster journey + archive screenshots/HAR/console @ current SHA |

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
| **Status** | **OPEN** |
| **Reproduction** | Run `scripts/test-dp*.sh` without `pnpm build` → `MODULE_NOT_FOUND` for package `dist`, `guard:import-boundary` fails without `workspace-sdk/dist` |
| **Required rerun** | `pnpm build` (or CI snapshot) then full DP script chain; record SHA + exit codes in closure ledger |

---

## DRF-006 — Payment expiry live replay not browser-certified

| Field | Value |
|-------|-------|
| **Phase** | DP-1 |
| **Severity** | P0 (closure) |
| **Role** | Operator, Member |
| **Status** | **OPEN** |
| **Evidence** | Automated 25/25 claimed @ `9bbf358e`; DP1-M journeys not archived |
| **Required rerun** | BR-OP-03 expiry, BR-MEM-03 closed `payment_expired`, BR-WL-01 with worker tick or test clock |

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
