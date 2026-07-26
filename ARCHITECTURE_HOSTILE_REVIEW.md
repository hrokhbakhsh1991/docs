# ARCHITECTURE_HOSTILE_REVIEW

```yaml
review_id: ARCHITECTURE_HOSTILE_REVIEW
role: Principal Software Architect — Hostile Production Readiness
date: "2026-07-20"
method: code + git + CI + migration filesystem (docs/comments treated as claims, not evidence)
release_candidate_sha: f6a820a15d35464fcbc06fc849dac9d141da7b28
branch: booking/capacity-concurrency-cert
vs_origin_main: "42 commits ahead, 0 behind (unmerged)"
working_tree: "dirty — ~23 modified + untracked remediations NOT on SHA"
gh_auth: "unavailable — branch protection on main UNPROVEN"
```

**Scope audited (runtime, not narrative):** `apps/api`, `packages/workspaces/*`, `apps/api/prisma/migrations`, `.github/workflows`, `scripts/vps-deploy`, `scripts/ops`, auth/tenant/storage/booking/finance paths, OpenAPI booking surface.

**Non-goals:** No fixes. No trust of prior agent reports, maturity docs, or “LANDED” banners unless the binary path proves them.

---

## 1. Executive verdict

**REJECT for production / security-audit gate.**

Booking capacity concurrency and Postgres-backed HTTP proofs exist as **engineering artifacts** on branch `booking/capacity-concurrency-cert` at `f6a820a1`. That is not the same as a **releasable, fail-closed, merge-gated production surface**.

What the repository actually shows:

| Claim often made | What code/git prove |
| ---------------- | ------------------- |
| “Booking remediations landed” | Fail-closed harness, storage default, P6 HTTP-PG DoD live in **dirty WT only** — **absent on SHA** |
| “Production auth harness is safe” | On SHA: `isProductionAuthHarnessActive` = flag alone; **bypasses** `assertProductionStorageDriver` |
| “Migration head governs deploy” | `EXPECTED_PRISMA_MIGRATION_HEAD` frozen at `20260706130000_*` while latest folder is `20260720140000_finance_recon_rls` — **`guard-migration-head-preflight` FAILS now** |
| “Booking Postgres is required on main” | Workflow + scripts exist; **`gh` cannot prove** required checks on `main` |
| “Capability maturity LANDED” | Denali/booking-ws2 `eventReaction.enabled: false` (Option A off) while docs say maturity landed |
| “F-17 proves prod JWT → tour create” | On SHA: harness + memory + HTTP **201**. In WT: diluted to kernel-only + unauthenticated **401** — **neither** is a clean prodlike HTTP-PG JWT tour create |
| “Apps are plugin-clean” | Generated loaders still hard-bind Denali packages; static `DEV_TENANTS`; smoke seeds keyed to Denali tenant UUID |

**Bottom line:** Treat `f6a820a1` as a **feature branch snapshot with known security dilutions**, not a release candidate. Treat the dirty working tree as **unapproved WIP**. Do not ship either without a new SHA that closes P0s and is merge-protected on `main`.

---

## 2. Production readiness score: **3 / 10**

| Dimension | Score | Rationale |
| --------- | ----- | --------- |
| Booking domain depth (capacity, approve concurrency, PG specs) | 6/10 | Real Prisma paths + CI workflow jobs exist |
| Auth / session integrity | 2/10 | Harness hole on SHA; `sess_ver` unused; platform ops shared bearer |
| Tenant isolation completeness | 4/10 | RLS exists for bookings/payments; boot probe table list incomplete; payment update-by-id pattern |
| Storage / SoT honesty | 3/10 | Dual memory/prisma factories; SHA harness bypass; WT remediations uncommitted |
| Migration / deploy governance | 1/10 | Head constant **14+ migrations stale**; guard failing; prod boot would mismatch |
| CI ↔ branch protection | 2/10 | Local name-check scripts OK; **main enforcement unproven** |
| Multi-workspace / second customer | 2/10 | Only `denali` production-certified; stubs everywhere else |
| Documentation honesty | 2/10 | “LANDED”, F-17 checklist, P6 traceability still memory-era in places |

**Aggregate 3/10** — not “almost ready.” Suitable for continued lab/CI work only.

---

## 3. Critical risks

### R1 — Release SHA ≠ working tree (approval fraud surface)

- **Committed:** `f6a820a1` — Booking CI gates, HTTP-PG cert, recon RLS migration, outbox grants, reject_reason.
- **Uncommitted (31 porcelain paths):** harness fail-closed, storage default/`DATABASE_URL`→prisma, P6 gate swap to `test:booking-http-postgres`, branch-protection scripts, F-17 rewrite, remediation docs.
- **Risk:** Approving “Booking remediations” while merging/deploying SHA (or the reverse) silently reopens security holes.

### R2 — Production auth harness is an intentional production bypass on SHA

At `HEAD`:

```ts
// apps/api/src/test/production-auth-harness.ts (committed)
export function isProductionAuthHarnessActive(...) {
  return env.APPS_API_PRODUCTION_AUTH_HARNESS?.trim() === "1";
}
```

`assertProductionStorageDriver` **returns early** when harness is active → production `NODE_ENV` + harness + memory storage is a designed escape hatch. Any mis-set env in a prodlike cluster disables forensic storage and RLS SoT for tours/bookings factories that share this guard.

### R3 — Migration head preflight is dead / inverted

- Constant: `20260706130000_app_cloud_nosuperuser`
- Disk latest: `20260720140000_finance_recon_rls`
- `node apps/api/scripts/guard-migration-head-preflight.mjs` → **FAIL** (verified this review)
- Production boot calls `assertProductionMigrationHead` inside `assertProductionDatabaseIntegrity`
- **Consequence A:** Fully migrated DB + this binary → **boot refuse** (`PRODUCTION_MIGRATION_HEAD_MISMATCH`)
- **Consequence B:** Operators “fix” by skipping migrate / pinning old head → **reject_reason, recon RLS, outbox grants never applied** while app code assumes them
- Guard lives mainly under phase-5 evolution path — **not** an unavoidable merge gate for this booking branch

This alone is enough to fail a security/change-management audit.

### R4 — Session revocation is theater

`requireOperatorSession` → `hydrateMembershipFromDb(auth.userId, auth.tenantId, undefined)` — **`sessionVersion` claim never passed**.

Membership `sessionVersion` is written in identity repos; JWT path can mint claims; **revocation-by-version does not execute** on the operator booking surface.

### R5 — Platform ops auth is a shared static bearer

`assertPlatformOpsAuth`: single `readPlatformOpsBearerToken()` compared to `Authorization`, plus `x-platform-ops-phone`. This is **not** per-operator crypto identity. Compromise of one secret = platform tenant CRUD / domain / subscription surface.

### R6 — Integrity gates keyed only to `NODE_ENV === "production"`

Staging / “prodlike” / `development` with real customer data **skips** harness absence, storage forbid, Redis assert, DB integrity probe. Security audit will treat this as **environment-name security**.

### R7 — Branch not on `main`; Booking checks unenforced (evidence gap)

- `origin/main...HEAD` = `0 42` (42 commits not merged)
- `gh api .../branches/main/protection` → **auth required** — cannot prove Booking jobs are required
- Docs/scripts *claim* required checks; **claims ≠ GitHub state**

### R8 — Dual repository reality (memory still first-class)

`createTourStorageRepository` / `getBookingsRepository` both construct in-memory SoTs. P6 historically certified `bookings-ops` (memory). WT moves P6 to HTTP-PG; **SHA P6 still lists memory `bookings-ops`**. Fake maturity: green gates on the wrong SoT.

---

## 4. P0 blockers

Must be closed before any production traffic or external security audit sign-off.

| ID | Blocker | Evidence |
| -- | ------- | -------- |
| **P0-01** | Freeze a single releasable SHA; ban dirty-WT approval | git status vs `f6a820a1` |
| **P0-02** | Close harness in production (fail if flag set; active only `NODE_ENV=test`) | HEAD harness vs WT remediation |
| **P0-03** | Remove harness bypass from `assertProductionStorageDriver` | HEAD `production-storage-driver-assert.ts` |
| **P0-04** | Sync `EXPECTED_PRISMA_MIGRATION_HEAD` to latest migration; make guard **merge-blocking** on booking/finance paths | guard FAIL today |
| **P0-05** | Prove `main` branch protection requires exact job names `Booking PostgreSQL capacity` + `Booking HTTP PostgreSQL` | `gh` unauthenticated |
| **P0-06** | Restore honest F-17: production JWT → HTTP tour/booking write on **Prisma + Postgres registry**, or formally retire F-17 and rewrite deploy checklist | HEAD 201+harness; WT kernel-only; checklist still says “JWT HTTP → POST /tours 201” |
| **P0-07** | Pass and enforce `sessionVersion` on hydrate for operator sessions | `require-operator-session.ts` `undefined` |
| **P0-08** | Replace or cryptographically harden platform-ops shared bearer | `assert-platform-ops-auth.ts` |
| **P0-09** | Outbox relay / projection defaults: production must not silently run with relay off without explicit risk accept | CI sets `OUTBOX_RELAY_ENABLED=false`; start is opt-in |
| **P0-10** | Expand production RLS boot probe beyond 5 tables to include `operator_registrations`, `payments`, finance recon tables | `TENANT_RLS_TABLES` omits booking/finance money path |

---

## 5. P1 risks

| ID | Risk | Notes |
| -- | ---- | ----- |
| **P1-01** | `payment.update({ where: { id } })` after tenant find | Relies on RLS; no composite `tenantId` in where — defense-in-depth weak |
| **P1-02** | `operatorRegistration.update({ where: { id } })` for paymentStatus | Same pattern inside `withTenantRls` |
| **P1-03** | Rate-limit Redis assert skipped when RL disabled | `assertProductionRedisUrl` returns if `enabled === false` — prod can run without RL |
| **P1-04** | Header-only ingress still in `requireOperatorSession` / kernel for non-production | Easy to misdeploy `NODE_ENV` |
| **P1-05** | Only `denali` in `WORKSPACE_PRODUCTION_CERTIFICATION` = `certified` | Second enterprise product type blocked; urban/booking-ws2 stubs |
| **P1-06** | Booking `eventReaction` Option A off on Denali + booking-ws2 | “Supported booking” ≠ durable reactions |
| **P1-07** | Generated HTTP/settings still import `@app-tour/workspace-denali/...` | Peer workspaces are not equal; Denali is still the gravity well |
| **P1-08** | Files/storage smoke paths keyed to `OPERATOR_DENALI_SMOKE_TENANT_ID` | Multi-tenant file assumptions fragile |
| **P1-09** | P6 docs/traceability still cite `bookings-ops` as SoT | Doc/runtime drift after TODO-008 WT change |
| **P1-10** | Capability maturity doc `status: LANDED` while grades intentionally incomplete | Audit will call this false advertising |
| **P1-11** | OpenAPI booking module exists + cert spec — not proven equal to every route error map | Drift risk under rapid booking changes |
| **P1-12** | VPS deploy scripts (`scripts/vps-deploy/*`) are ops folklore — no proof they enforce P0 env matrix | Deploy path ≠ CI path |
| **P1-13** | Finance recon tables shipped then RLS-added later | Window of cross-tenant DML if migrate partial |
| **P1-14** | Pool / advisory-lock capacity under load | Stress jobs exist in CI; production pool sizing undocumented relative to cert |

---

## 6. P2 debt

| ID | Debt |
| -- | ---- |
| **P2-01** | Parallel in-memory booking + tour repositories (~800–1000 LOC each) forever tempting wrong gate |
| **P2-02** | Static `DEV_TENANTS` registry (correctly blocked in production, still large attack/confusion surface in staging) |
| **P2-03** | Many finance-ws\* / booking-ws2 packages as **fixtures** mixed with production Denali |
| **P2-04** | Host `package.json` manual wiring for finance workspaces (onboarding lifecycle admits non-zero-touch) |
| **P2-05** | Phase hooks suspension / fast-track culture vs full integrity — easy to never run migration-head guard |
| **P2-06** | Duplicate booking capability docs (maturity, lifecycle, dependency registry, remediation TODOs) without a single “runtime truth” index pinned to SHA |
| **P2-07** | CASL / operator ability breadth (historical over-broad Tour manage) — not re-proven in this pass for booking routes |
| **P2-08** | Guest email uniqueness / duplicate booking constraints weak vs urban registration unique indexes |
| **P2-09** | Notifications “Missing” / incomplete side-effects relative to outbox events |
| **P2-10** | Branch soup (`finance/*`, `feat/psc-*`, `wip/portal-*`, `booking/*`) — merge order risk onto `main` |

---

## 7. Incorrect assumptions found

1. **“Remediations are done because docs/TODO markdown exist.”**  
   False — harness/storage/P6 changes are **uncommitted**.

2. **“`APPS_API_PRODUCTION_AUTH_HARNESS` is test-only.”**  
   False on SHA — any env can set it; storage assert honors it under `NODE_ENV=production`.

3. **“Migration head preflight protects production.”**  
   False today — constant stale; guard fails; implies either boot break or skipped governance.

4. **“F-17 = production JWT creates tours over HTTP.”**  
   False on SHA (harness+memory). False in WT (no HTTP 201). Deploy checklist still states the old claim.

5. **“Booking Postgres workflow ⇒ main is protected.”**  
   False — workflow presence ≠ required status check; `gh` cannot verify.

6. **“`workspaceBooking.supported: true` ⇒ enterprise booking complete.”**  
   False — graded capabilities; eventReaction off; maturity model itself says `supported` is only a product gate — then docs stamp **LANDED**.

7. **“Production integrity covers all tenant tables.”**  
   False — boot RLS list omits bookings/payments/recon.

8. **“Operator session hydrate enforces sess_ver.”**  
   False — always `undefined`.

9. **“Platform ops is first-class IAM.”**  
   False — shared bearer + phone header.

10. **“P6 gate proves Postgres booking DoD.”**  
    False on SHA — still runs memory `bookings-ops.spec.ts`.

11. **“Zero platform code to add a workspace.”**  
    Architecture target ≠ today — codegen + host deps + CERT + Denali-depth adapters.

12. **“Dirty WT fail-closed harness means production is safe.”**  
    False until committed, CI-green, and protected on `main`.

---

## 8. Missing tests

| Gap | Why it matters |
| --- | -------------- |
| **Prod boot with harness=1 must throw** (on release SHA) | Exists in WT spec file; **not on SHA** |
| **F-17 HTTP 201 with `NODE_ENV=production`, JWT, `STORAGE_DRIVER=prisma`, real tenant row, no harness** | Neither SHA nor WT currently owns this cleanly |
| **`hydrateMembershipFromDb` rejects stale `sess_ver` on booking routes** | No evidence of end-to-end revoke |
| **Platform ops auth abuse** (token reuse, missing phone, role escalation) | Shared bearer needs adversarial suite |
| **Migration head guard in Booking / PR CI** | Currently fail-local; not blocking this branch’s primary workflow |
| **RLS boot probe for `operator_registrations` + `payments` + recon** | Tables have RLS migrations; boot doesn’t assert them |
| **`payment.update` cross-tenant id guessing under RLS** | Explicit adversarial test missing |
| **Outbox relay enabled path for booking approve → consumer** with process restart | Partial reaction specs; CI defaults relay off |
| **Branch-protection live verify** (`gh api` / Actions required contexts) | Scripts exist; no recorded green proof |
| **P6 gate on SHA vs WT** contract test that fails if memory bookings-ops returns | Prevent gate regression |
| **OpenAPI ↔ `bookings.routes` exhaustive status/code parity** beyond existing cert slices | Drift under rapid change |
| **Staging/`NODE_ENV!=production` prodlike matrix** | Current model assumes name==security |

---

## 9. Recommended remediation order

Execute strictly in order. Do not start product features (new workspace, E8) until **E0** closes.

### E0 — Release floor (this week)

1. Decide: **ship remediations** or **revert WT** — pick one truth.
2. Commit harness fail-closed + storage assert without bypass + tests.
3. Fix `EXPECTED_PRISMA_MIGRATION_HEAD` → `20260720140000_finance_recon_rls` (or whatever is tip); fix unit that hardcodes old name; run guard in booking workflow.
4. Restore or replace F-17 with **Prisma HTTP** proof; update deploy checklist to match code.
5. `gh auth` → apply/verify `main` required checks (Phase 0/1 + both Booking PG jobs).
6. Tag SHA; forbid merge of dirty trees.

### E1 — Identity

7. Wire `sess_ver` from JWT → `hydrateMembershipFromDb`.
8. Kill header-only operator path outside `NODE_ENV=test` (or equivalent explicit allowlist).
9. Redesign platform-ops auth (per-user JWT/OIDC; no shared bearer).

### E2 — DB write hygiene

10. Composite where clauses (`id` + `tenantId`) on payment/registration updates.
11. Expand `TENANT_RLS_TABLES` (+ FORCE) for booking/finance money path.
12. Adversarial cross-tenant IDOR tests under app role.

### E3 — Events / notifications

13. Explicit production posture for `OUTBOX_RELAY_ENABLED` (fail-closed or monitored required).
14. Decide Option A eventReaction: keep off with **honest** maturity status, or implement durable path.

### E4 — Rate limit / pool

15. Disallow RL-off in production without break-glass.
16. Document pool vs capacity cert parameters.

### E5 — Capabilities / entitlements

17. Demote maturity docs from LANDED until grades match customer contract.
18. Entitlement tests per module for multi-tenant.

### E6 — Audit / files

19. Remove Denali-smoke-tenant special cases from production-reachable paths.

### E7 — Workspace / second customer

20. Only after E0–E2: certify peer workspace or second Denali tenant with domains/WRS/PCMS.

### E8 — Features

21. New booking capabilities only on green E0 SHA.

---

## Appendix A — Runtime call graph (Booking operator, Prisma path)

```text
HTTP bookings.routes
  → requireOperatorSession
       → assertOperatorAuthIngress (bearer | cookie | header-only*)
       → resolveTenantContextFromRequest (prod: bearer required)
       → hydrateMembershipFromDb(user, tenant, sess_ver=UNDEFINED)  // P0-07
  → BookingsService
       → getBookingsRepository
            → assertProductionStorageDriver  // SHA: harness bypass
            → PrismaBookingsRepository | InMemoryBookingsRepository
       → withTenantRls(tenantId) → set_config app.current_tenant_id
            → operator_registrations / capacity lock / outbox writes
```

\*Header-only rejected in production at kernel if no Authorization — still dangerous under wrong `NODE_ENV`.

## Appendix B — Documented architecture vs actual

| Documented (v2 / deploy checklist) | Actual |
| ---------------------------------- | ------ |
| Plugins; no workspace forks in apps | Generated Denali imports; smoke UUID special cases |
| Manifest authority + CERT | Only denali certified |
| Prod JWT HTTP tour create (F-17) | Harness memory 201 (SHA) or kernel-only (WT) |
| Migration head matches disk | **Mismatch — guard FAIL** |
| Booking PG required on main | Unproven |
| Memory forbidden in production | True only if harness unset / WT remediations shipped |

## Appendix C — Git truth snapshot (2026-07-20)

```text
HEAD     f6a820a1  fix(booking): CI Postgres gates, HTTP-PG cert, recon RLS, list correctness
branch   booking/capacity-concurrency-cert  (no upstream tracking shown)
main     b79f34ef  (origin/main)
ahead    42 commits
dirty    harness, storage, auth-env, tenant-registry, P6 gate, branch-protection scripts, docs, specs
```

---

**Sign-off:** Hostile review — **DO NOT ship**. Re-review only against a clean SHA with P0-01…P0-10 closed and `main` protection verified via authenticated GitHub API.

Architect, documentation status: **Updated**. Link to docs: [`ARCHITECTURE_HOSTILE_REVIEW.md`](./ARCHITECTURE_HOSTILE_REVIEW.md).
