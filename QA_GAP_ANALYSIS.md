# QA_GAP_ANALYSIS

```yaml
audit_id: QA_GAP_ANALYSIS
role: QA Lead — Hostile Production Release Gate
date: "2026-07-20"
disposition: REJECT — do not approve production release
method: inspect test code + package scripts + CI workflows + required-check scripts (passing tests ≠ production proof)
```

## Release decision

**REJECT.**

Existing green bars are **insufficient** for production approval because:

1. Most booking/API suites default to **memory** SoT (`STORAGE_DRIVER` default memory; `OUTBOX_RELAY_ENABLED=false`; `TENANT_RATE_LIMIT_ENABLED=false`).
2. The only strong PG proofs are **narrow**, often **below HTTP**, and use **header auth** — not production JWT.
3. Critical security/DB gaps from hostile audits have **no corresponding required CI tests**.
4. **Branch protection on `main` is unproven** (`gh` unauthenticated); scripts claiming required checks are not live evidence.
5. Several “cert” suites **silently skip** without Postgres → false green on developer laptops / misconfigured CI.

---

## How to read this document

| Column | Meaning |
| ------ | ------- |
| **Missing test** | What must exist before QA signs release |
| **Why existing tests are insufficient** | Why current specs do not count as proof |
| **Risk** | Production failure mode if shipped anyway |
| **Exact test needed** | Concrete scenario + assert |
| **Priority** | P0 block release / P1 before GA / P2 debt |

---

## Gaps

### G-01 — Production JWT → HTTP booking/tour write (real Prisma + registry)

| Field | Content |
| ----- | ------- |
| **Missing test** | `NODE_ENV=production` + RS256 JWT + `STORAGE_DRIVER=prisma` + real `tenants` row → `POST /bookings` and/or `POST /tours` → **201** with DB row; no harness; no `x-*` identity headers. |
| **Why existing insufficient** | `tenant-security` F-17 (WT) only asserts kernel context + unauthenticated 401 — **not** HTTP create. SHA historically used harness + memory 201. `bookings-http-postgres` uses **header auth** (`x-tenant-id` / `x-user-id`), which production kernel **rejects**. Deploy checklist still implies F-17 HTTP 201. |
| **Risk** | Ship with auth that only works in test shims; production JWT path unproven end-to-end. |
| **Exact test needed** | Seed tenant via admin; mint JWT with `sess_ver`; `POST /bookings` with `Authorization` only; assert 201 + `operator_registrations` row; assert header-only request 401. |
| **Priority** | **P0** |

---

### G-02 — HTTP booking matrix must not silently skip without Postgres

| Field | Content |
| ----- | ------- |
| **Missing test** | Fail-closed entry: if `test:booking-http-postgres` / capacity jobs run without `DATABASE_URL`, process **exits non-zero** (no `skip: !hasDatabase`). |
| **Why existing insufficient** | `test/bookings-http-postgres.spec.ts` uses `describe(..., { skip: !hasDatabase })`. Local/`pnpm test` without DB → **0 tests, green**. CI workflow sets DB, but any job that forgets env still looks healthy if this file is pulled into a soft suite. |
| **Risk** | False confidence; regressions merge without PG proof. |
| **Exact test needed** | Dedicated script (already partially style of capacity specs): missing env → throw at start. CI step `test -n "$DATABASE_URL"`. |
| **Priority** | **P0** |

---

### G-03 — Approve concurrency proven at repository, not HTTP

| Field | Content |
| ----- | ------- |
| **Missing test** | N parallel `POST /bookings/:id/approve` against one API listener (or two processes) with capacity=1 → exactly one 200, others 409; occupancy invariant in PG. |
| **Why existing insufficient** | `booking-prisma-approve-concurrency.spec.ts` calls `repo.approveWithOutbox` directly — **bypasses** `requireOperatorSession`, routes, rate limit, ALS tenant binding, error map. Capacity PG proofs similarly race repository workers. |
| **Risk** | Route/middleware races, double response, or auth bypass under load unseen. |
| **Exact test needed** | HTTP concurrency harness sharing `createRequestListener` + Prisma; assert status codes + SQL sum(party_size). |
| **Priority** | **P0** |

---

### G-04 — Outbox **effect** path never required in CI

| Field | Content |
| ----- | ------- |
| **Missing test** | Approve → `outbox_events` pending → **relay enabled** → row processed / consumer invoked (or poisoned with retry). |
| **Why existing insufficient** | Booking CI sets `OUTBOX_RELAY_ENABLED=false`. Default `pnpm test` same. HTTP-PG asserts outbox **insert** only. In-process reaction Option A off — no substitute. |
| **Risk** | Approvals “succeed”; downstream finance/integration never runs in production if relay misconfigured. |
| **Exact test needed** | Job with relay worker + `OUTBOX_RELAY_ENABLED=true`; poll until status≠pending; fail on lag SLA. |
| **Priority** | **P0** |

---

### G-05 — P6 / trunk still treat memory `bookings-ops` as product proof (SHA)

| Field | Content |
| ----- | ------- |
| **Missing test** | Release gate that **fails** if DoD runs `bookings-ops.spec.ts` (memory) instead of `test:booking-http-postgres`. |
| **Why existing insufficient** | `bookings-ops.spec.ts` uses `installMemoryStorageDriverForDescribe()` + `peekOutboxByAggregateForTests` (in-memory). Committed `p6-denali-product-gate.sh` still lists it; WT swaps to HTTP-PG but **uncommitted**. Dozens of booking `*.spec.ts` pin `STORAGE_DRIVER=memory`. |
| **Risk** | Product exit signed on fake SoT (no RLS, no advisory locks). |
| **Exact test needed** | Gate script grep deny-list; required CI = HTTP-PG + capacity only for booking DoD. |
| **Priority** | **P0** |

---

### G-06 — Session revocation (`sess_ver`) untested on booking routes

| Field | Content |
| ----- | ------- |
| **Missing test** | Issue JWT with `sess_ver=1`; bump `user_tenants.session_version` to 2; `POST /bookings/.../approve` → 401 revoked. |
| **Why existing insufficient** | Specs seed `sessionVersion: 1` but never assert mismatch. `requireOperatorSession` passes `undefined` into hydrate — even a test that minted `sess_ver` would not exercise revoke today; **gap is both product + QA**. Signing tests check claim presence only (`identity-jwt-signing.spec.ts`). |
| **Risk** | Fired admin keeps approving until JWT expiry. |
| **Exact test needed** | PG identity + JWT + booking approve before/after version bump. |
| **Priority** | **P0** |

---

### G-07 — RLS coverage incomplete vs threat model (urban / users / domains / recon)

| Field | Content |
| ----- | ------- |
| **Missing test** | As `app_tour` + GUC tenant A: `SELECT`/`UPDATE` victim rows in `urban_registrations`, `users`, `tenant_domains`, `finance_recon_*` (pre/post migrate), `operator_registrations`, `payments`. |
| **Why existing insufficient** | HTTP-PG `T2` checks registration RLS for one path. `test:finance-recon-rls` exists but is **not** in `booking-postgres-gate.yml` nor `MAIN_BRANCH_REQUIRED_CHECKS`. Phase-4 RLS spec does not cover urban/users/domains (confirmed no matches). Boot probe omits booking/payment tables — no test that boot fails when those lack FORCE RLS. |
| **Risk** | Cross-tenant read/write on tables without RLS ships unnoticed. |
| **Exact test needed** | Expand `rls-isolation` / new `database-security.postgres.spec.ts`; add `test:finance-recon-rls` + urban/users/domains cases to **required** CI. |
| **Priority** | **P0** |

---

### G-08 — Guest duplicate race (DB uniqueness) untested

| Field | Content |
| ----- | ------- |
| **Missing test** | Two parallel public/operator creates same `(tenant, tour, email)` → exactly one success; other conflict. |
| **Why existing insufficient** | Duplicate logic is `findFirst` then insert; no unique index; no parallel PG test. Memory duplicate scans are not concurrency-safe proof. |
| **Risk** | Double bookings / capacity skew under click-retry. |
| **Exact test needed** | `Promise.all` two HTTP creates; assert DB count=1 or unique violation mapping. |
| **Priority** | **P0** |

---

### G-09 — Production auth harness / memory storage fail-closed not on release SHA

| Field | Content |
| ----- | ------- |
| **Missing test** | On **release commit**: `NODE_ENV=production` + `APPS_API_PRODUCTION_AUTH_HARNESS=1` → boot throws; `STORAGE_DRIVER=memory` → boot throws; required CI job. |
| **Why existing insufficient** | Fail-closed harness specs live in **dirty WT** (`production-auth-harness.spec.ts` untracked). Committed SHA still allows harness to bypass storage assert. Not in booking required checks. |
| **Risk** | Prodlike env with harness flag → memory SoT / diluted gates. |
| **Exact test needed** | Commit + run in `booking-postgres-gate` or phase-4 production-env job; assert exit codes. |
| **Priority** | **P0** |

---

### G-10 — Migration head preflight not a required check

| Field | Content |
| ----- | ------- |
| **Missing test** | CI job running `guard:migration-head-preflight` must pass on every booking/finance PR. |
| **Why existing insufficient** | Guard **FAIL**s today (constant stuck at `20260706130000_*`). Not invoked by `booking-postgres-gate.yml`. Easy to ship schema/code skew. |
| **Risk** | Missing recon RLS / grants while app assumes them — or boot mismatch. |
| **Exact test needed** | Workflow step; fail PR on mismatch. |
| **Priority** | **P0** |

---

### G-11 — `main` required checks not verified live

| Field | Content |
| ----- | ------- |
| **Missing test** | Authenticated proof: GitHub branch protection contexts include exact names `Booking PostgreSQL capacity` + `Booking HTTP PostgreSQL` (+ Phase 0/1). |
| **Why existing insufficient** | `verify-required-check-names.mjs` only checks YAML↔script string sync. `MAIN_BRANCH_REQUIRED_CHECKS` is aspirational. `gh api` protection → auth required (unproven). |
| **Risk** | PRs merge with booking PG jobs failing/skipped. |
| **Exact test needed** | Ops job or release checklist artifact: `gh api .../protection` JSON asserting contexts; refresh on each release. |
| **Priority** | **P0** |

---

### G-12 — Receipt upload authz ordering / IDOR

| Field | Content |
| ----- | ------- |
| **Missing test** | Member A binary `POST /bookings/{B's id}/receipts` → 403 **and** no object stored (or deleted). |
| **Why existing insufficient** | HTTP-PG `RC1` happy-path member owner only. Does not assert pre-authz upload side effect. |
| **Risk** | Storage DoS / orphan objects / cross-booking probing. |
| **Exact test needed** | Minio/fake storage spy; assert zero `put` before ownership failure. |
| **Priority** | **P1** |

---

### G-13 — Payment projection IDOR (update by id) under RLS

| Field | Content |
| ----- | ------- |
| **Missing test** | Tenant A session attempts `payment`/`operator_registrations` update with B’s UUID → 0 rows / sync miss. |
| **Why existing insufficient** | Unit tests of `raiseBookingPaymentStatus` ranking; finance shared-infra isolation is partial; no adversarial HTTP receipt-approve with stolen payment id across tenants in required CI. |
| **Risk** | Cross-tenant payment status corruption if RLS/GUC wrong. |
| **Exact test needed** | PG: set GUC A, `UPDATE payments SET status=… WHERE id=B` → 0; finance approve with foreign registrationId → error. |
| **Priority** | **P1** |

---

### G-14 — Finance receipt approve atomicity under abort / booking sync fail

| Field | Content |
| ----- | ------- |
| **Missing test** | Required CI: approve receipt when booking row missing → full TX rollback (payment not Paid); relay/compensation paths. |
| **Why existing insufficient** | `finance.service.spec` / FIN-SVC-* largely memory fakes. PG atomic paths exist but not in booking required gate. Test abort hooks are easy to leave env-polluted. |
| **Risk** | Money Paid without booking projection or partial commits. |
| **Exact test needed** | `STORAGE_DRIVER=prisma` receipt approve matrix in required workflow. |
| **Priority** | **P1** |

---

### G-15 — Rate limit / Redis production posture untested in booking CI

| Field | Content |
| ----- | ------- |
| **Missing test** | `NODE_ENV=production` + RL enabled + missing `REDIS_URL` → boot fail; RL disabled in production → explicit fail or break-glass. |
| **Why existing insufficient** | Default tests set `TENANT_RATE_LIMIT_ENABLED=false`. Booking PG CI same. Guards exist as static scripts, not runtime booking path under load. |
| **Risk** | Prod without RL or with memory limiter. |
| **Exact test needed** | production-runtime-env cases in required job; optional load test with Redis. |
| **Priority** | **P1** |

---

### G-16 — Determinism: stress randomness + `--test-force-exit`

| Field | Content |
| ----- | ------- |
| **Missing test** | Seeded RNG stress with reproducible seed; hang detector without force-exit masking; flake quarantine budget = 0 for release. |
| **Why existing insufficient** | Capacity stress uses random waves; all booking PG scripts use `--test-force-exit` (hides open handles/hangs). Default API test `--test-concurrency=1` hides parallel bugs then “fixed” only in dedicated jobs. |
| **Risk** | Flaky release; CI green while handles leak in prod. |
| **Exact test needed** | Fixed seed; fail on open handles in release job; publish flake rate. |
| **Priority** | **P1** |

---

### G-17 — Multi-workspace / second tenant certification untested

| Field | Content |
| ----- | ------- |
| **Missing test** | Provision second tenant (same `denali` + new workspace stub) through production provision path; booking HTTP matrix on both. |
| **Why existing insufficient** | Fixtures use smoke UUIDs / integration tenant; only `denali` production-certified; urban/booking-ws2 mostly memory capability tests. |
| **Risk** | First-customer-only assumptions; second customer breaks isolation. |
| **Exact test needed** | Two-tenant PG HTTP suite + domain bind smoke. |
| **Priority** | **P1** |

---

### G-18 — Edge cases thinly covered on HTTP-PG

| Field | Content |
| ----- | ------- |
| **Missing test** | Bulk approve partial capacity; waitlist→approve race; reject vs concurrent approve (HTTP); cancel during approve; idempotent double approve via HTTP; empty bulk; max batch+1. |
| **Why existing insufficient** | HTTP-PG has ~16 cases (C/A/R/W/X/B/L/S/RC/T). Stress/concurrency cover some at repo layer. Reject/approve lost-update is stress-level, not HTTP required. |
| **Risk** | Edge 409/200 mismatches; client retries corrupt state. |
| **Exact test needed** | Expand HTTP-PG matrix with table-driven edges; all required in CI. |
| **Priority** | **P1** |

---

### G-19 — Default `pnpm test` is anti-proof for production

| Field | Content |
| ----- | ------- |
| **Missing test** | Separate `test:production-path` alias that **refuses** memory and **requires** PG; release uses only that + booking gate. |
| **Why existing insufficient** | `apps/api` `"test"` defaults memory, disables relay & rate limit, concurrency=1. ~205 memory-oriented vs ~85 prisma mentions — volume ≠ production. Guards in pretest are static, not runtime PG. |
| **Risk** | Developers/CI “all tests passed” without production SoT. |
| **Exact test needed** | Document + enforce: memory suites = unit only; cannot satisfy release checklist. |
| **Priority** | **P1** |

---

### G-20 — Phase 5/4/full integrity not required for booking merge

| Field | Content |
| ----- | ------- |
| **Missing test** | Explicit release train: booking merge requires booking PG + migration head + recon RLS; full `ci:integrity` only with Architect YES — but booking P0s above must not wait for 30min gate. |
| **Why existing insufficient** | `MAIN_BRANCH_REQUIRED_CHECKS` lists Phase 0/1 + Booking PG only — **good scope** — but missing recon RLS, migration head, harness, JWT HTTP. Phase-4/5 gates exist as workflows, not in required list. |
| **Risk** | Booking “certified” while DB security holes remain. |
| **Exact test needed** | Extend required checks list after adding jobs (not full monorepo gate). |
| **Priority** | **P1** |

---

## What existing PG tests *do* prove (limited credit)

| Suite | Proves | Does **not** prove |
| ----- | ------ | ------------------- |
| `test:booking-capacity-postgres` | Advisory lock + occupancy under Prisma workers | HTTP/auth/relay |
| `test:booking-approve-concurrency` | Repo-level approve races | Route stack |
| `test:booking-capacity-stress` | Invariant under random waves (repo) | Deterministic seed / HTTP |
| `test:booking-http-postgres` | Header-auth HTTP → Prisma for listed cases + one RLS read | JWT prod auth, relay, silent-skip safety |
| Memory `bookings-ops` | Handler wiring on fake SoT | Anything production |

---

## CI / required-checks scorecard

| Control | Status |
| ------- | ------ |
| Workflow `booking-postgres-gate.yml` exists | Yes |
| Runs capacity + concurrency + stress + HTTP-PG | Yes (when DB service up) |
| `OUTBOX_RELAY_ENABLED` | **false** |
| Auth in HTTP-PG | **Headers, not JWT** |
| `test:finance-recon-rls` in that workflow | **No** |
| `guard:migration-head-preflight` in that workflow | **No** |
| Name sync script vs YAML | Local OK |
| Live `main` protection contexts | **Unproven** |
| P6 DoD = HTTP-PG on committed SHA | **No** (still memory ops) |

---

## Minimum release test plan (QA sign-off checklist)

Do **not** sign until all P0 items below are **green on a single release SHA** with artifact links:

1. G-01 JWT HTTP create (bookings + tours) Prisma  
2. G-02 no silent skip  
3. G-03 HTTP approve concurrency  
4. G-04 outbox relay effect  
5. G-05 P6/DoD memory banned  
6. G-06 sess_ver revoke  
7. G-07 RLS battery (urban/users/domains/recon/registrations/payments) required  
8. G-08 duplicate create race  
9. G-09 harness/memory fail-closed on SHA  
10. G-10 migration head guard green  
11. G-11 `gh` proof of required checks on `main`

---

## Verdict

**QA Lead: REJECT production release.**

Passing memory suites and even the current Booking PostgreSQL workflow are **necessary but not sufficient**. Treat memory tests as design feedback only. Treat repository concurrency as component tests only. Approve only after the P0 gap list is closed with **fail-closed**, **non-skipping**, **production-auth**, **Postgres** proofs wired as **required** checks on `main`.

Architect, documentation status: **Updated**. Link to docs: [`QA_GAP_ANALYSIS.md`](./QA_GAP_ANALYSIS.md).
