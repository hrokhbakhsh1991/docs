# Production Closure Ledger — Denali

```yaml
ledger_id: PRODUCTION-CLOSURE-LEDGER-2026-08-24
program: Denali Product → Production
authority_product: docs/dev/denali-product-completion-plan.md
reconciled_at: 2026-08-25
reconciled_commit: 425d0c952356b8ce60c5cba9d6bb5d05adbb1b89
wave_b_cert_sha: ba7b37fa3075fc09651b7d66b47d6e3550d3425e
wave_b5_cert_sha: 425d0c952356b8ce60c5cba9d6bb5d05adbb1b89
wave_b_evidence: docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/
wave_b5_evidence: docs/evidence/denali-wave-b5/425d0c952356b8ce60c5cba9d6bb5d05adbb1b89/
branch: cursor/denali-wave-b-runtime-closure-bef0
origin_main: 8ef3f4a6
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
| HEAD | `ba7b37fa3075fc09651b7d66b47d6e3550d3425e` (Wave B branch) |
| `origin/main` | `8ef3f4a6` baseline |
| Wave B evidence | `docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/` |
| Working tree | clean |

Recent DP commits on `main`: `09ba2b09` (DP-6 live E2E script) · `14514e9f` (DP-6) · `1d0fd635` (DP-5) · `b6c4fbb2` (DP-4) · `9bbf358e` (DPR remediation) · `5638f48f` (DP-3) · DP-2 roster · DP-1 payment deadline chain.

---

## PRODUCT — DP phase closure

Hard rule (unchanged): **`[x]` requires automated certification + browser/runtime evidence** (screenshot + network + domain state). Automated-only → `[v]`.

| Phase | Implementation | Automated evidence | Browser/runtime | Final marker | Notes |
|-------|----------------|-------------------|-----------------|--------------|-------|
| **DP-0** Truth freeze | Partial docs | Partial | Baseline archived Wave B | `[v]` | **DP0-05 SIGNED** 2026-08-25 B5 — first-launch scope lock below |
| **DP-1** Payment deadline | **YES** | **PASS** @ B5 regression | **PASS** Wave B `dp1-member-deadline-1440.png` | **`[x]`** | DRF-006 **CLOSED** |
| **DP-2** Unified roster | **YES** | **PASS** @ B5 regression | **PASS** Wave B `dp2-roster-1440.png` | **`[x]`** | DRF-002 **CLOSED** |
| **DP-3** Tour mutation safety | **YES** | **PASS** @ B5 regression | **PARTIAL** — flat-edit form + before screenshot; UI PATCH save harness incomplete | **`[v]`** | API matrix PASS; safe/capacity UI save not BROWSER_UI_PROVEN |
| **DP-4** Member self-service + inbox | **YES** | **PASS** @ B5 regression | **PASS** Wave B portal screenshots | **`[x]`** | LF-006 **CLOSED** |
| **DP-5** Driver settlement | **YES** (in-memory v1) | **PASS** @ B5 regression | **MISSING** | **`[N/A]`** first launch | Bus-only first customer — impl retained |
| **DP-6** Refund orchestration | **YES** | **PASS** @ B5 regression + live seed | **PASS** B5 — `dp6-member-refund-1440/390.png` + BFF JSON | **`[x]`** | Operator refund parity in `dp6-operator-refunds.json` |
| **DP-7** Post-tour closure | **NO** | — | — | **`[ ]`** | Not started; minimum slice only at launch |
| **DP-8** Golden real-club cert | **NO** | — | — | **`[ ]`** | Not started |

### Automated script inventory

| Script | Layers | Reconciliation run |
|--------|--------|-------------------|
| `scripts/test-dp1-payment-deadline.sh` | finance-core, denali, tour-core, api dp1/*, portal, web | **PASS** @ `7628fcd9` |
| `scripts/test-dp2-operational-roster.sh` | denali domain, api dp2/*, web roster | **PASS** @ `7628fcd9` |
| `scripts/test-dp3-tour-mutation.sh` | denali policy, api dp3, regressions, guards | **PASS** @ `7628fcd9` |
| `scripts/test-dp4-member-self-service.sh` | denali policy, api dp4, portal, dp1–3 regression, guards | **PASS** @ `7628fcd9` |
| `scripts/test-dp5-driver-settlement.sh` | api dp5, web contract, guards | **PASS** @ `7628fcd9` |
| `scripts/test-dp6-refund-orchestration.sh` | api dp6, dp4/5/1 regression, guards | **PASS** @ `7628fcd9` |
| `scripts/denali-wave-b-runtime-cert.sh` | live API + portal BFF memory driver | **PASS** @ `7628fcd9` |
| `scripts/denali-wave-b-browser-evidence.sh` | portal + operator Playwright screenshots | **PASS** @ Wave B branch |

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

**PRODUCT_DECISION_REQUIRED:** ~~Confirm first club uses bus-only~~ **RESOLVED 2026-08-25 B5** — first customer **bus-only / no in-product driver compensation** → DP-5 **`[N/A]_FIRST_LAUNCH`**.

**DP0-05 sign-off (2026-08-25 Wave B.5):** REQUIRED at go-live: DP-1, DP-2, DP-3, DP-4, DP-6, member receipt upload, **DP-8**. NOT required first launch: Wallet, DP-7, Ticketing, Weather, DP-5 (when bus-only).

---

## Browser / runtime evidence census

Evidence store: Wave B `docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/` · Wave B.5 `docs/evidence/denali-wave-b5/425d0c952356b8ce60c5cba9d6bb5d05adbb1b89/`

| Phase | Automated | Live runtime | Browser | Artifact |
|-------|-----------|--------------|---------|----------|
| **DP-1** | PASS B5 | Wave B JSON | Wave B `dp1-member-deadline-1440.png` | regression + Wave B |
| **DP-2** | PASS B5 | roster filters | Wave B `dp2-roster-1440.png` | regression + Wave B |
| **DP-3** | PASS B5 | API 200/409 | **PARTIAL** flat-edit before screenshot; classifications `dp3-*-classification.txt` | B5 + Wave B API |
| **DP-4** | PASS B5 | portal BFF | Wave B portal screenshots | regression + Wave B |
| **DP-5** | PASS B5 | N/A first launch | — | — |
| **DP-6** | PASS B5 | live refund seed | **B5** `dp6-member-refund-1440/390.png` + cancellation BFF | `dp6-operator-refunds.json` |

**B8 Postgres subset:** **BLOCKED_EXTERNAL** — no Docker client in Cloud VM; `postgres-environment.json` documents required input (`pnpm run infra:up` + `ensure-p6-finance-postgres.sh`).

---

## Runtime findings index

Canonical file: `docs/dev/denali-runtime-findings.md`

| ID | Summary | Severity | Fix status |
|----|---------|----------|------------|
| DRF-001 | Postgres member receipt upload may 500 (`RECEIPT_UPLOAD_FAILED`) | P1 | **CLOSED** memory @ `7628fcd9`; Postgres **NEEDS_VERIFICATION** |
| DRF-002 | DP-2 browser cert ledger `[x]` reverted without artifact retention | P1 | **CLOSED** @ `7628fcd9` — `browser/dp2-roster-1440.png` |
| DRF-003 | Master product ledger stale vs DP-4/5/6 implementation | P0 doc | **CLOSED** this reconciliation |
| DRF-004 | `denali-product-completeness-audit.md` missing | P1 doc | **OPEN** — superseded by this ledger + updated completion plan |
| DRF-005 | DP certification scripts NOT_REPRODUCED in unbuilt checkout | P1 env | **CLOSED** @ `7628fcd9` |
| DRF-006 | Payment expiry live replay not browser-certified | P0 | **CLOSED** @ `7628fcd9` — live extend + scheduler JSON |

DPR-001..006 (payment hold correctness): **CLOSED** @ `9bbf358e` — see `dp-1-execution-plan.md`.

---

## LOST_FOLLOW_UP register

| ID | Source | Claim | Reconciled status |
|----|--------|-------|-------------------|
| LF-001 | `dp-1-execution-plan.md` DP1-L Playwright E2E | **CLOSED** — superseded by Wave B `denali-wave-b-portal-evidence.spec.ts` + runtime cert |
| LF-002 | DP1-M browser cert | **CLOSED** @ `7628fcd9` live expiry evidence |
| LF-003 | DP2 browser revert | **CLOSED** @ `7628fcd9` new roster screenshot |
| LF-004 | `denali-product-completion-plan.md` DP3-09 | Date change vs refund/cancel | **CLOSED** @ B5 — DEN-PROD-10 notification-only matrix sufficient; no invented cancellation/refund rights |
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
| `DATABASE_URL` / Postgres available | **BLOCKED_EXTERNAL** | unset in Wave B VM — B8 not faked PASS |
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

1. **PR #109 merge** — 19 CI failures; `origin/main` remains `8ef3f4a6`.
2. **B8 Postgres subset** — BLOCKED_EXTERNAL (no Docker in Cloud VM).
3. **DP-8** Golden certification not started.
4. **Postgres receipt upload** (DRF-001 Postgres path).

### P1

1. ~~**DP0-05**~~ — **CLOSED** B5 first-launch scope sign-off.
2. **DP-3 operator flat-edit UI save** — Playwright harness does not complete PATCH save (safe edit + capacity increase).
3. **DP-5 persistence** — OPEN only if driver pay added to launch scope (currently N/A).

---

## Wave B.5 verdict (2026-08-25)

**`DENALI_RUNTIME_NOT_CLOSED`** — blockers: PR #109 not merged; Postgres BLOCKED_EXTERNAL; DP-3 UI PATCH save incomplete; DRF-001 Postgres; DP-8 not started.

**Closed in B.5:** DP-6 portal authenticated refund UI (`[x]`); DP0-05 first-launch scope; LF-004 date-mutation policy.

**Memory-driver regression:** DP-1..4, DP-6 scripts **PASS** @ `425d0c95`; `guard:import-boundary` PASS.

Evidence: `docs/evidence/denali-wave-b5/425d0c952356b8ce60c5cba9d6bb5d05adbb1b89/`

---

## Wave B verdict (2026-08-24)

**Superseded by Wave B.5** for DP-6 portal UI and scope sign-off. Wave B memory evidence remains valid for DP-1/2/4.

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
