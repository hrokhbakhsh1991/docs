# Production Closure Ledger — Denali

```yaml
ledger_id: PRODUCTION-CLOSURE-LEDGER-2026-08-24
program: Denali Product → Production
authority_product: docs/dev/denali-product-completion-plan.md
reconciled_at: 2026-08-25
reconciled_commit: b04f70e1c5a8636bec2f280bc42f4dc89527c690
merge_commit: b04f70e1c5a8636bec2f280bc42f4dc89527c690
pr109_head: 9a313ac81cc17fdf227256d96d321fec4d9ef183
wave_b_cert_sha: ba7b37fa3075fc09651b7d66b47d6e3550d3425e
wave_b5_cert_sha: 425d0c952356b8ce60c5cba9d6bb5d05adbb1b89
post_merge_closure_sha: b04f70e1c5a8636bec2f280bc42f4dc89527c690
wave_b_evidence: docs/evidence/denali-wave-b/ba7b37fa3075fc09651b7d66b47d6e3550d3425e/
wave_b5_evidence: docs/evidence/denali-wave-b5/425d0c952356b8ce60c5cba9d6bb5d05adbb1b89/
post_merge_evidence: docs/evidence/denali-wave-b5/b04f70e1c5a8636bec2f280bc42f4dc89527c690/
branch: main
mode: POST_MERGE_SMALL_LAUNCH_CLOSURE
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
| **DP-3** Tour mutation safety | **YES** | **PASS** @ merge main | **PASS** post-merge Playwright @ `b04f70e1` — safe edit + capacity UI save, API deny/price/date | **`[x]`** | Flat-edit uses server action (not browser PATCH); harness fixed |
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

## Post-merge small launch closure (2026-08-25)

**PR #109** merged → `b04f70e1`. Required CI (6/6) green on `9a313ac8`.

### Evidence carry-forward (pre-merge Wave B → merge `b04f70e1`)

| DP | Classification | Rationale |
|----|----------------|-----------|
| DP-1 | **CARRY_FORWARD_VALID** | Payment-hold extend + harness fixes; no silent-reject impact on deadline semantics |
| DP-2 | **CARRY_FORWARD_VALID** | Roster semantics unchanged; thin-shell transport filter is display-only |
| DP-3 | **RERUN_REQUIRED → CLOSED** | Auth header + silent reject do not alter mutation matrix; UI save harness fixed post-merge |
| DP-4 | **CARRY_FORWARD_VALID** | Portal BFF routes stable; member cancel unchanged |
| DP-6 | **CARRY_FORWARD_VALID** | Refund orchestration + member-cancellation DI move preserve policy |

Post-merge evidence: `docs/evidence/denali-wave-b5/b04f70e1c5a8636bec2f280bc42f4dc89527c690/`

### Approve without payment / waiver (Case 4)

| Item | Status |
|------|--------|
| Domain + Finance | **FULLY_IMPLEMENTED** — `setRegistrationObligationOverride` + `applyFreeCollectionPayment` |
| CASE 1 (approve unpaid) | **FULLY_IMPLEMENTED** — `approve` → `paymentStatus=unpaid`, hold scheduled, `finalParticipant=false` until settled |
| CASE 2 (explicit waiver) | **FULLY_IMPLEMENTED** — zero obligation override → `remainingMinor=0`, `paymentStatus=paid`, roster `WAIVED` display, no cash receipt |
| Operator UI | **FULLY_IMPLEMENTED** — Finance tab → Advanced tools → «تأیید بدون نیاز به پرداخت» (`detailOverrideNoPayment`) |
| Bookings CC one-click | **UI_MISSING** (P2) — two-step approve then finance waive is canonical; no product blocker |
| Browser cert | **PASS** @ `b04f70e1` — API + finance workspace screenshot |

### Mainline proof @ `b04f70e1`

| Check | Result |
|-------|--------|
| `pnpm build` | **PASS** |
| `test-dp1` … `test-dp6` | **PASS** |
| `guard:import-boundary` | **PASS** |
| `phase-10:guard` | **PASS** |
| `guard:migration-head-preflight` (@apps/api) | **PASS** |
| `git diff --check` | **PASS** |

### Staging readiness (prep only — no deploy)

See § Staging inventory below. Customer apex domain **not** required; use `{club}.{root}` / IP per `docs/phase-19/p6/runbooks/staging-deploy.md`.

---

## Wave C — staging deploy / golden certification (2026-08-25)

**SHA:** `734c4642` · **Host:** Cloud Agent VM (substitute staging; canonical VPS `89.45.89.206` unreachable from agent network)

### Deployment status

| Item | Result |
|------|--------|
| Postgres `tour_db_staging` @ `:5432` | **PASS** — native PG16, migrations through `20260824120000_dp1_payment_holds` |
| MinIO @ `:9002` bucket `app-tour-staging` | **PASS** |
| Env `/etc/app-tour-staging/` | **PASS** — `NODE_ENV=production`, `AUTH_ALLOW_DEV_STATIC_OTP=false`, secrets not in git |
| Production builds (api dist + next start) | **PASS** |
| Four-process smoke | **PASS** — ports `23000–23003` |
| Profile B URLs | `http://3.130.31.173:23000` admin · `:23002` marketing · `:23003` portal · API `:23001` |

### Postgres DP persistence (C8)

| DP | Postgres integration specs | Result |
|----|---------------------------|--------|
| DP-1 | `dp1/payment-hold-expiry`, waitlist, idempotency | **PASS** 7/7 |
| DP-2 | `dp2/operational-roster-*` | **PASS** |
| DP-3 | `dp3/tour-mutation-enforcement` | **PASS** |
| DP-4 | `dp4/member-cancellation` | **PASS** |
| DP-6 | `dp6/refund-orchestration` | **PASS** |
| **Total** | 29 integration tests `STORAGE_DRIVER=prisma` | **PASS** 29/29 |

Live API restart persistence (C8 manual) | **NOT_RUN** — automated Postgres specs cover lifecycle; live restart matrix deferred to VPS golden.

### Receipt / storage (C9)

| Check | Result |
|-------|--------|
| `test:minio-photo` round-trip | **PASS** 5/5 |
| Portal → BFF → API → MinIO → Finance browser path (DRF-001) | **NOT_RUN** |
| Storage failure safe error | **NOT_RUN** |

### DP-8 Golden browser (C10)

| Journey | Result |
|---------|--------|
| A paid participant | **NOT_RUN** |
| B expiry/waitlist | **NOT_RUN** |
| C waived | **NOT_RUN** |
| D cancel/refund | **NOT_RUN** |
| E mutation safety | **NOT_RUN** |

**Blocker:** `NODE_ENV=production` + `AUTH_ALLOW_DEV_STATIC_OTP=false` — OTP codes not delivered without `RESEND_API_KEY`/SMS; browser operator/member login cannot complete without external OTP channel.

### Backup / restore (C11)

| Item | Result |
|------|--------|
| `pg_dump -Fc tour_db_staging` | **PASS** (~366KB, &lt;1s) |
| Restore to `tour_db_staging_restore` | **PASS** — tenant row count match (2) |

### Wave C verdict

**`DENALI_STAGING_NOT_CERTIFIED`** — partial staging on Cloud VM; DP-8 golden browser + DRF-001 portal receipt + finance-ops T3 on live stack remain open.

Evidence: `docs/evidence/denali-wave-c/734c4642983aa85ce2ff0b3a286152569a7d0356/`

---

## Remaining P0 / P1 (product)

### P0

1. ~~**PR #109 merge**~~ — **CLOSED** @ `b04f70e1`.
2. **B8 Postgres subset** — BLOCKED_EXTERNAL in Cloud dev VM (no Docker); required on staging host.
3. **DP-8** Golden certification not started.
4. **Postgres receipt upload** (DRF-001 Postgres path on staging).

### P1

1. ~~**DP0-05**~~ — **CLOSED** B5 first-launch scope sign-off.
2. ~~**DP-3 operator flat-edit UI save**~~ — **CLOSED** @ `b04f70e1` Playwright evidence.
3. **DP-5 persistence** — OPEN only if driver pay added to launch scope (currently N/A).
4. **Bookings CC one-click waive** — optional UX; finance Advanced tools sufficient for launch.

---

## Wave B.5 verdict (2026-08-25)

**`SMALL_LAUNCH_CLOSED — READY_FOR_STAGING`** (prep). Deploy blocked on DP-8 + staging Postgres + receipt storage until inputs below supplied.

**Closed:** PR #109 merge; DP-3 UI `[x]`; waiver Case 4 certified; mainline scripts green.

Evidence: `docs/evidence/denali-wave-b5/b04f70e1c5a8636bec2f280bc42f4dc89527c690/`

---

## Wave B verdict (2026-08-24)

**Superseded by Wave B.5** for DP-6 portal UI and scope sign-off. Wave B memory evidence remains valid for DP-1/2/4.

1. Build monorepo (`pnpm build`) then green: `test-dp1` → `test-dp2` → `test-dp3` → `test-dp4` → `test-dp6` (+ `test-dp5` if in scope).
2. Browser certs: DP-1 (operator+member+waitlist) → DP-2 (roster) → DP-3 (mutation UI) → DP-4 (portal) → DP-6 (paid cancel/refund).
3. Archive evidence under `/opt/cursor/artifacts/denali-dp/` with SHA `09ba2b09` or post-fix SHA.
4. Postgres-targeted subset before staging.

**Not Wave B:** DP-7 feature work, DP-8 full golden, Wallet, architecture refactors.

---

## Staging inventory (prep — deploy not executed)

### Services

| Service | Port (dev) | Staging notes |
|---------|------------|---------------|
| `@apps/api` | 3001 / 4000 | `STORAGE_DRIVER=prisma`, Postgres required |
| `apps/web` | 3000 | Operator admin `{club}.admin.{root}` |
| `apps/portal` | 3003 | Member `{club}.portal.{root}` |
| `apps/marketing` | 3002 | Public `{club}.{root}` |

### Environment variables

| Variable | Group | Status |
|----------|-------|--------|
| `DATABASE_URL` | DATABASE | **SECRET_REQUIRED** |
| `DATABASE_URL_ADMIN` | DATABASE | **SECRET_REQUIRED** (migrate deploy) |
| `STORAGE_DRIVER=prisma` | DATABASE | **READY** |
| `AUTH_JWT_PUBLIC_KEY` / `AUTH_JWT_PRIVATE_KEY` | AUTH | **SECRET_REQUIRED** |
| `AUTH_ALLOW_DEV_STATIC_OTP` | AUTH | **READY** = `false` on staging |
| `ALLOW_DEV_WEB_SESSION` | AUTH | **READY** = `false` on staging |
| `PLATFORM_ROOT_DOMAIN` | TENANT | **MISSING** (staging root domain) |
| `TOUR_OPS_API_URL` | INTERNAL | **READY** (per-app) |
| `MARKETING_PUBLIC_BASE_URL` | PUBLIC | **MISSING** |
| `PORTAL_PUBLIC_BASE_URL` | PUBLIC | **MISSING** |
| `MINIO_*` or object storage | STORAGE | **SECRET_REQUIRED** — receipt proof; memory forbidden |
| `REDIS_URL` | SECURITY | **OPTIONAL** (rate limit in prod) |
| `LOG_HASH_KEY` / `AUDIT_PSEUDONYM_KEY` | SECURITY | **SECRET_REQUIRED** |
| `NODE_ENV=production` | FEATURE | **READY** |
| `OUTBOX_RELAY_ENABLED` | FEATURE | **OPTIONAL** (worker split) |

### Migration plan (non-destructive)

1. Create staging Postgres DB + `app_tour` role (`docs/phase-4/dev/init/01-app-role.sql`)
2. `pnpm --filter @apps/api run prisma:generate`
3. `pnpm --filter @apps/api run guard:migration-head-preflight`
4. `DATABASE_URL_ADMIN=… pnpm --filter @apps/api run db:migrate:deploy`
5. Seed minimal Denali workspace (dev seed scripts / staging seed TBD)
6. Start API → web → portal → marketing with staging env
7. Health: `GET /health`, `GET /public/tenant-context` per host

### Receipt staging plan

- **Driver:** S3-compatible (MinIO or cloud bucket) — **not** memory
- **Path:** Portal upload → portal BFF → API `receipt-proof-storage` → bucket + DB metadata → Finance review
- **Proof:** Portal upload E2E on staging with real storage namespace per tenant

### First-launch feature freeze

**IN:** tour create/publish, registration, approve/reject/waitlist, capacity, payment deadline/expiry, payment, roster, member cancel, refund, mutation safety, receipt upload.

**DEFERRED:** Wallet, passenger-driver assignment, DP-7 accounting, profitability, social/comments, Ticketing, Weather, advanced analytics.

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
