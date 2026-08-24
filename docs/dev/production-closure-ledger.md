# Production Closure Ledger — Denali

```yaml
ledger_id: PRODUCTION-CLOSURE-LEDGER-2026-08-24
program: Denali Product → Production
authority_product: docs/dev/denali-product-completion-plan.md
reconciled_at: 2026-08-24
reconciled_commit: 09ba2b09906fde8d7104489fa8401ef4d9ab2e99
branch: main
mode: TRUTH_RECONCILIATION — no product behavior change
```

Canonical bridge between **product completion (DP)** and **real production readiness**.

Status vocabulary:

| Marker | Meaning |
|--------|---------|
| `[x]` | COMPLETE — verified with evidence at listed SHA |
| `[v]` | IMPLEMENTED / automated verified; runtime or external proof pending |
| `[!]` | BLOCKED — product decision or external dependency |
| `[ ]` | NOT STARTED |
| `[N/A]` | Explicitly out of first-launch scope |
| `FAIL` | Ran and failed |
| `NOT_REPRODUCED` | Not executed in reconciliation run (environment or scope) |

**Never** mark missing environment proof as PASS.

---

## Git truth (reconciliation run)

| Field | Value |
|-------|-------|
| Branch | `main` |
| HEAD | `09ba2b09906fde8d7104489fa8401ef4d9ab2e99` |
| `origin/main` | same SHA (synced 2026-08-24 reconciliation) |
| Working tree | clean |

Recent DP commits on `main`: `09ba2b09` (DP-6 live E2E script) · `14514e9f` (DP-6) · `1d0fd635` (DP-5) · `b6c4fbb2` (DP-4) · `9bbf358e` (DPR remediation) · `5638f48f` (DP-3) · DP-2 roster · DP-1 payment deadline chain.

---

## PRODUCT — DP phase closure

Hard rule (unchanged): **`[x]` requires automated certification + browser/runtime evidence** (screenshot + network + domain state). Automated-only → `[v]`.

| Phase | Implementation | Automated evidence | Browser/runtime | Final marker | Notes |
|-------|----------------|-------------------|-----------------|--------------|-------|
| **DP-0** Truth freeze | Partial docs | Partial | Baseline not archived | `[ ]` | DP0-01/04/06/07/08 open; DP0-05 unsigned |
| **DP-1** Payment deadline | **YES** `main` | `[v]` — `scripts/test-dp1-payment-deadline.sh`; `dp-1-execution-plan.md` 25/25 @ `9bbf358e` | **MISSING** — DP1-M open | **`[v]`** | NOT_REPRODUCED this run (missing package `dist`) |
| **DP-2** Unified roster | **YES** `main` | `[v]` — `scripts/test-dp2-operational-roster.sh` + domain specs | **STALE** — prior `[x]` reverted `9126e966`; no artifact on `main` | **`[v]`** | Downgraded from erroneous ledger `[x]` |
| **DP-3** Tour mutation safety | **YES** `main` | `[v]` — `scripts/test-dp3-tour-mutation.sh` + `dp3/tour-mutation-enforcement.spec.ts` | **MISSING** — DP3-13 | **`[v]`** | DP3-14 closure without browser — stays `[v]` |
| **DP-4** Member self-service + inbox | **YES** `b6c4fbb2` | `[v]` — `scripts/test-dp4-member-self-service.sh` | **MISSING** — DP4-11 | **`[v]`** | Ledger rows were stale `[!]` |
| **DP-5** Driver settlement | **YES** `1d0fd635` (in-memory v1) | `[v]` — `scripts/test-dp5-driver-settlement.sh` | **MISSING** — DP5-15; live E2E scripts exist | **`[v]`** or **`[N/A]`** launch scope — see First Customer |
| **DP-6** Refund orchestration | **YES** `14514e9f` | `[v]` — commit notes 9/9; `scripts/test-dp6-refund-orchestration.sh` | **MISSING** — DP6-11; live E2E script `09ba2b09` | **`[v]`** | |
| **DP-7** Post-tour closure | **NO** | — | — | **`[ ]`** | Not started; minimum slice only at launch |
| **DP-8** Golden real-club cert | **NO** | — | — | **`[ ]`** | Not started |

### Automated script inventory

| Script | Layers | Reconciliation run |
|--------|--------|-------------------|
| `scripts/test-dp1-payment-deadline.sh` | finance-core, denali, tour-core, api dp1/*, portal, web | **NOT_REPRODUCED** — missing `booking-http-contracts/dist`, API dp1/* module resolution |
| `scripts/test-dp2-operational-roster.sh` | denali domain, api dp2/*, web roster | **NOT_REPRODUCED** — same dist gap |
| `scripts/test-dp3-tour-mutation.sh` | denali policy, api dp3, regressions, guards | **NOT_REPRODUCED** — dist + multiple API spec failures in unbuilt env |
| `scripts/test-dp4-member-self-service.sh` | denali policy, api dp4, portal, dp1–3 regression, guards | **NOT_REPRODUCED** — `guard:import-boundary` needs `workspace-sdk/dist` |
| `scripts/test-dp5-driver-settlement.sh` | api dp5, web contract, guards | **NOT_REPRODUCED** |
| `scripts/test-dp6-refund-orchestration.sh` | api dp6, dp4/5/1 regression, guards | **NOT_REPRODUCED** |

Historical green (trusted only at cited SHA, not re-run here):

- `docs/dev/dp-1-execution-plan.md` — **DP-1 AUTOMATED_CERTIFIED** 25/25 after `9bbf358e`
- `14514e9f` — DP-6 scenario matrix **9/9 pass** (author commit message)

---

## PRODUCT — DEN-PROD decision reconciliation

| Gate | Classification | Evidence / decision source |
|------|----------------|----------------------------|
| **DEN-PROD-01** Payment deadline | **APPROVED** | `docs/dev/dp-1-execution-plan.md` § Approved decisions — 24h default, per-tour override |
| **DEN-PROD-02** Approved-unpaid holds seat | **APPROVED** | same — paired with expiry |
| **DEN-PROD-03** Final participant | **APPROVED** 2026-08-24 Wave B | See § DEN-PROD-03 below; parity with `operational-roster-semantics.ts` |
| **DEN-PROD-04** Expiry representation | **APPROVED** | Hold + `approved→cancelled`, `cancelSource=payment_deadline` |
| **DEN-PROD-05** Wallet | **DEFERRED_POST_PRODUCTION** | Product direction 2026-08-24; ledger + completion plan |
| **DEN-PROD-06** Driver compensation basis | **APPROVED** | `docs/workspaces/denali/driver-settlement.mdoc` — min(offered, assigned) at freeze |
| **DEN-PROD-07** Payable trigger | **APPROVED** | same — operator confirm after roster freeze |
| **DEN-PROD-08** Refund destination | **APPROVED** (initial release) | `docs/workspaces/denali/refund-orchestration.mdoc` — manual payout only at launch |
| **DEN-PROD-09** Member cancellation | **APPROVED** | `docs/workspaces/denali/member-cancellation-policy.mdoc` |
| **DEN-PROD-10** Tour mutation matrix | **APPROVED** | `docs/workspaces/denali/tour-mutation-safety.mdoc` |
| **DEN-PROD-11** Quote freeze on approve | **APPROVED** | `docs/dev/dp-1-execution-plan.md` |
| **DEN-PROD-12** Notification channels | **APPROVED** | Portal inbox required; email async optional — `docs/dev/dp-4-execution-plan.md` |

---

## DEN-PROD-03 — Final participant (decision packet)

**Formal status:** **APPROVED** — recorded 2026-08-24 Wave B before runtime closure execution.

**Decision owner:** Product owner (Wave B lock).

### Approved definitions

```text
operationalParticipant :=
  registration.status === "approved"

financiallySettled :=
  remainingAmount === 0
  OR an explicitly supported waived/free obligation state

finalParticipant :=
  operationalParticipant AND financiallySettled

occupiesCapacity :=
  separate predicate — approved registrations consume seats (DN-CAT-05)
```

### Truth table (approved registrations)

| Payment state | operational | final | occupies capacity |
|---------------|-------------|-------|-------------------|
| unpaid | true | false | true |
| partial | true | false | true |
| paid | true | true | true |
| waived/free | true | true | true |
| waitlisted | false | false | false |
| rejected | false | false | false |
| cancelled | false | false | false |
| payment-expired (cancelled hold) | false | false | false |

**Invariant:** `paid` alone does not bypass registration approval — non-approved rows are never final.

### Implementation parity (`main`)

Source: `packages/workspaces/denali/src/roster/operational-roster-semantics.ts`

| Predicate | Rule in code | Parity |
|-----------|--------------|--------|
| `isOperationalParticipant` | `status === "approved"` | YES |
| `isFinanciallySettled` | `remainingMinor` parses to `0` (waived counts) | YES |
| `isFinalParticipant` | approved AND financially settled | YES |
| Roster filters | `operational`, `final`, `unpaid`, `paid`, `expiring`, `waitlist` | YES |

Transport tab / day-of roster defaults to **operational** (approved), not **final**, unless UI selects `filter=final`.

### Deferred (not DEN-PROD-03)

Post-tour **attendance** (DP-7) remains separate — not implemented. Day-of “actually attending” is not collapsed into final participant.

---

## FIRST CUSTOMER — DENALI scope lock

**Default first-customer posture:** paid offline operations with personal-car intake possible; **driver in-product compensation not promised unless product owner signs otherwise.**

| Capability | Classification | Notes |
|------------|----------------|-------|
| Wizard / publish / catalog | **REQUIRED_FOR_PAID_OPERATIONS** | Pre-DP baseline certified |
| Offline finance / receipts | **REQUIRED_FOR_PAID_OPERATIONS** | `DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md` READY_FOR_FIRST_CUSTOMER |
| DP-1 payment deadline / expiry | **REQUIRED_FOR_PAID_OPERATIONS** | Impl `[v]`; browser pending |
| DP-2 operational roster | **REQUIRED_FOR_PAID_OPERATIONS** | Impl `[v]`; browser pending |
| DP-3 tour mutation safety | **REQUIRED_FOR_PAID_OPERATIONS** | Impl `[v]`; browser pending |
| DP-4 member cancel + portal inbox | **REQUIRED_FOR_PAID_OPERATIONS** | Impl `[v]`; browser pending |
| DP-6 cancel ↔ refund orchestration | **REQUIRED_FOR_PAID_OPERATIONS** | Impl `[v]`; browser pending |
| Member receipt upload | **REQUIRED_FOR_PAID_OPERATIONS** | P6 certified; Postgres path needs re-verify (DRF-001) |
| Payment expiry **live replay** (worker + clock) | **REQUIRED_FOR_PAID_OPERATIONS** | Automated; browser + prod-like replay pending |
| Notifications (portal inbox) | **REQUIRED_FOR_PAID_OPERATIONS** | DP-4; email async optional |
| **Wallet** | **DEFERRED_POST_PRODUCTION** | DEN-PROD-05 |
| **Driver settlement (DP-5)** | **OPTIONAL_FOR_LAUNCH** → **`[N/A]`** if bus-only / no in-product driver pay | Impl remains certified asset; not deleted |
| **Post-tour closure (DP-7)** | **DEFERRED_POST_PRODUCTION** (minimum slice) | DP7-03/05 may become required if club closes AR on-trip |
| **DP-8 Golden cert** | **REQUIRED_BEFORE_GO_LIVE** | Not started |
| Ticketing / Weather | **DEFERRED_POST_PRODUCTION** | Out of scope |

**PRODUCT_DECISION_REQUIRED:** Confirm first club uses **bus-only** (DP-5 `[N/A]`) vs **personal-car driver compensation in-product** (DP-5 required for launch).

---

## Browser / runtime evidence census

Evidence store policy: `/opt/cursor/artifacts/` (runtime) · `docs/dev/evidence/denali-dp/` (committed thumbs — **no commits on `main` yet**).

| Phase | Automated script | Historical / commit evidence | Browser journey | Artifact class |
|-------|------------------|------------------------------|-----------------|----------------|
| **DP-1** | `test-dp1-payment-deadline.sh` | 25/25 @ `9bbf358e` in `dp-1-execution-plan.md` | BR-OP-01..04, BR-MEM-01..03, BR-WL-01 defined | **AUTOMATED_ONLY** |
| **DP-2** | `test-dp2-operational-roster.sh` | `6431af73` marked browser `[x]` — **superseded** | Operator roster 1440 — `seed-dp2-physical-cert-fixture.mjs` references `/opt/cursor/artifacts/dp2-cert-*` | **STALE_EVIDENCE** (no files on `main` or artifact store) |
| **DP-3** | `test-dp3-tour-mutation.sh` | API enforcement spec | Operator edit published tour 1440 | **AUTOMATED_ONLY** |
| **DP-4** | `test-dp4-member-self-service.sh` | `member-cancellation.spec.ts`, portal specs | Portal cancel + inbox 1440+390 | **AUTOMATED_ONLY** |
| **DP-5** | `test-dp5-driver-settlement.sh` | `e2e-dp5-settlement-live.sh`, `e2e-dp5-settlement.sh` | Transport → freeze → payable → finance | **AUTOMATED_ONLY** (scripts exist; no archived run) |
| **DP-6** | `test-dp6-refund-orchestration.sh` | 9/9 @ `14514e9f` | `e2e-dp6-refund-live.sh` | **AUTOMATED_ONLY** |

**Reconciliation VM:** `/opt/cursor/artifacts` empty — no screenshots/HAR/video from this run.

---

## Runtime findings index

Canonical file: `docs/dev/denali-runtime-findings.md`

| ID | Summary | Severity | Fix status |
|----|---------|----------|------------|
| DRF-001 | Postgres member receipt upload may 500 (`RECEIPT_UPLOAD_FAILED`) | P1 | **NEEDS_VERIFICATION** on `main` + Postgres |
| DRF-002 | DP-2 browser cert ledger `[x]` reverted without artifact retention | P1 | **OPEN** — re-run Wave B |
| DRF-003 | Master product ledger stale vs DP-4/5/6 implementation | P0 doc | **CLOSED** this reconciliation |
| DRF-004 | `denali-product-completeness-audit.md` missing | P1 doc | **OPEN** — superseded by this ledger + updated completion plan |
| DRF-005 | DP certification scripts NOT_REPRODUCED in unbuilt checkout | P1 env | **OPEN** — CI/build snapshot must precede cert claims |

DPR-001..006 (payment hold correctness): **CLOSED** @ `9bbf358e` — see `dp-1-execution-plan.md`.

---

## LOST_FOLLOW_UP register

| ID | Source | Claim | Reconciled status |
|----|--------|-------|-------------------|
| LF-001 | `dp-1-execution-plan.md` DP1-L Playwright E2E | Still `[ ]` | **OPEN** — browser pending |
| LF-002 | `dp-1-execution-plan.md` DP1-M browser cert | Required for `[x]` | **OPEN** |
| LF-003 | `6431af73` → `9126e966` | DP2 browser `[x]` then reverted | **OPEN** — treat as never `[x]` without artifacts |
| LF-004 | `denali-product-completion-plan.md` DP3-09 | Date change vs refund/cancel | **OPEN** — product + DP-6 |
| LF-005 | `dp-1-execution-plan.md` DP1-K-02 | Grandfather approved-unpaid without hold | **OPEN** — optional backfill |
| LF-006 | `dp-1-execution-plan.md` DP1-J-03 | Notifications deferred to DP-4 | **CLOSED** — DP-4 inbox shipped `b6c4fbb2` |
| LF-007 | `p7-staging-e2e.md` | SMK-PTL-04 receipt 500 on Postgres | **NEEDS_VERIFICATION** → DRF-001 |
| LF-008 | `enterprise-maturity-plan.md` | `production-closure-ledger.md` when present | **CLOSED** — this file |
| LF-009 | Completion plan authority | `denali-product-completeness-audit.md` | **MISSING** — use completion plan + this ledger |
| LF-010 | DP-5 in-memory v1 | Postgres persistence for settlement | **OPEN** if DP-5 in launch scope |

---

## INFRA — external production closure

Destructive / live actions **not executed** in this reconciliation wave.

| Gate | Status | Evidence / notes |
|------|--------|----------------|
| `DATABASE_URL` / Postgres available | **NOT_STARTED** | unset in reconciliation VM |
| `DATABASE_URL_ADMIN` | **NOT_STARTED** | unset |
| Phase-4 / DB guards (`phase-4:guard`) | **IMPLEMENTED_NOT_VERIFIED** | `pnpm run phase-4:guard` not run |
| `release:verify` (`scripts/ops/run-gate-catalog.mjs --tier=L3`) | **NOT_STARTED** | not run |
| `db:migrate:deploy` | **NOT_STARTED** | requires Postgres |
| Staging URLs / DNS | **BLOCKED_EXTERNAL** | scripts exist (`p7:staging-*`, `p10:staging-gate`); live pack incomplete per PSR inventories |
| Staging smoke | **NOT_STARTED** | `pnpm run smoke:staging` not run |
| Backup/restore drill | **NOT_STARTED** | `scripts/restore-drill-smoke.sh` requires `DATABASE_URL_ADMIN` |
| Production URL | **BLOCKED_EXTERNAL** | not configured in this environment |
| Production read-only smoke | **NOT_STARTED** | |
| SBOM | **NOT_STARTED** | no root script found |
| Provenance / attestation | **NOT_STARTED** | no root script found |

---

## Remaining P0 / P1 (product)

### P0

1. **Browser/runtime closure** for DP-1, DP-2, DP-3, DP-4, DP-6 (Wave B).
2. **DP-8** Golden certification not started — blocks go-live narrative.
3. **DEN-PROD-03** unsigned — participant vocabulary not product-closed.
4. **Postgres parity** for DP money paths not evidenced on `main` closure record.

### P1

1. **DRF-001** — receipt upload on Postgres (re-verify).
2. **DP0-05** — MINIMUM PILOT vs PAID scope sign (Wallet/settlement boundary).
3. **DP3-09** — tour date change vs refund policy.
4. **DP-5 persistence** if driver pay in launch scope.
5. **DP7-03/05** if club closes trips with open AR/refunds.

---

## Next wave

**WAVE B — RUNTIME / BROWSER CLOSURE** (do not execute in Wave A):

1. Build monorepo (`pnpm build`) then green: `test-dp1` → `test-dp2` → `test-dp3` → `test-dp4` → `test-dp6` (+ `test-dp5` if in scope).
2. Browser certs: DP-1 (operator+member+waitlist) → DP-2 (roster) → DP-3 (mutation UI) → DP-4 (portal) → DP-6 (paid cancel/refund).
3. Archive evidence under `/opt/cursor/artifacts/denali-dp/` with SHA `09ba2b09` or post-fix SHA.
4. Postgres-targeted subset before staging.

**Not Wave B:** DP-7 feature work, DP-8 full golden, Wallet, architecture refactors.

---

## Cross-references

| Doc | Role |
|-----|------|
| `docs/dev/denali-product-completion-plan.md` | DP task ledger (synced this reconciliation) |
| `docs/dev/denali-runtime-findings.md` | Runtime finding detail |
| `docs/dev/dp-1-execution-plan.md` | DP-1 automated certification record |
| `docs/dev/dp-4-execution-plan.md` | DP-4 test matrix |
| `docs/dev/dp-5-execution-plan.md` | DP-5 test matrix |
| `docs/dev/dp-6-execution-plan.md` | DP-6 certification commands |

Architect, documentation status: **Updated**. Link to docs: `docs/dev/production-closure-ledger.md`.
