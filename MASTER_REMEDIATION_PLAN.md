# MASTER_REMEDIATION_PLAN

```yaml
plan_id: MASTER_REMEDIATION_PLAN
role: Engineering Manager
date: "2026-07-20"
sources:
  - ARCHITECTURE_HOSTILE_REVIEW.md
  - RUNTIME_PATH_AUDIT.md
  - DATABASE_SECURITY_AUDIT.md
  - QA_GAP_ANALYSIS.md
  - PRODUCTION_RELEASE_AUDIT.md
  - MULTI_TENANT_SCALABILITY_REVIEW.md
status: IN PROGRESS — implementation started 2026-07-20
verdict: NO PRODUCTION until all P0 closed on one clean SHA + proven main protection
progress:
  MR-P0-001: done (clean SHA after remediation commit)
  MR-P0-002: done (harness fail-closed; storage assert no bypass; 24/24 specs)
```


## How this plan was built

1. **Merged** duplicate findings across the six reports into single work items.  
2. **Dropped / demoted false or low-signal items** (see § False positives).  
3. **Prioritized by production risk:** boot failure, cross-tenant breach, silent wrong behavior, then scale/product.

| Priority | Meaning |
| -------- | ------- |
| **P0** | Must fix before any production traffic / “deploy tomorrow” |
| **P1** | Must fix before scaling (2nd product, ~100 tenants, heterogeneous rules) |
| **P2** | Technical debt — schedule, don’t block first hardened prod |

**Source ID legend:** `AH` Architecture Hostile · `RP` Runtime Path · `DB` Database · `QA` QA Gap · `REL` Production Release · `MT` Multi-Tenant Scalability

---

## False positives / demotions

| Item | Disposition | Why |
| ---- | ----------- | --- |
| “Plugins don’t exist / architecture is fiction” | Demoted | Plugin + codegen model is real; collapse is incomplete covenant + Denali gravity, not absence of plugins (`MT`) |
| Advisory lock MD5 collision as P0 | → **P2** (`MR-P2-003`) | Theoretical; capacity PG proofs exist; not blocking first prod if locks used |
| List+count non-snapshot read | → **P2** | UX inconsistency, not security breach |
| Reject silent (no outbox) as P0 | → **P2** | Documented product choice; fix as contract clarity |
| Finance-ws* fixtures “are production” | Removed as blocker | They are registry fixtures; risk is confusion at scale (`MT`) — covered by taxonomy P1 |
| “All memory tests prove nothing so delete them” | Demoted | Memory OK as unit feedback; **must not** gate release (`QA`) — covered by P0 gate rules |
| Capability Option A off as P0 deploy block | → **P1** | Blocks *event-driven* enterprise claims, not basic Denali ops if relay/product contract honest |
| WT vs SHA harness “already fixed” | Not a FP | Dirty WT ≠ shipped — remains **P0** until on release SHA |

---

## Dependency graph (P0)

```text
MR-P0-001 Release SHA freeze
    ├─► MR-P0-002 Harness / storage fail-closed
    ├─► MR-P0-003 Migration head sync
    ├─► MR-P0-004 Branch protection + deploy gates
    └─► (enables) all other P0 verification

MR-P0-003 ──► MR-P0-005 RLS completeness (recon already in tip)
MR-P0-006 Identity sess_ver + header lockdown
MR-P0-007 JWT HTTP production path (needs 002, 006, prisma)
MR-P0-008 Outbox relay production posture
MR-P0-009 Payment/booking write hygiene (composite where)
MR-P0-010 Receipt upload authz order
MR-P0-011 Guest duplicate uniqueness
MR-P0-012 Tables without RLS (urban/users/domains/…)
MR-P0-013 Deploy path: no silent skip, no cancel-mid-flight, no per-deploy dev bootstrap
MR-P0-014 Rollback = code + DB strategy
MR-P0-015 QA fail-closed (no silent skip PG suites)
```

---

# P0 — Must fix before production

---

### MR-P0-001

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-001 |
| **Problem** | No single releasable SHA: booking branch 42 commits ahead of `main`; critical remediations only in dirty working tree. |
| **Evidence** | `AH` R1; `REL-05`; `REL-15`; `git` ahead/dirty state |
| **Files** | (process) entire release train; dirty paths under `apps/api/src/test/production-auth-harness.ts`, `scripts/p6-denali-product-gate.sh`, etc. |
| **Risk** | Deploy wrong binary; approve “fixes” that never ship. |
| **Implementation plan** | 1) Decide ship set. 2) Commit remediations OR revert WT. 3) Tag SHA. 4) Forbid worktree→prod sync. 5) Merge to `main` only via protected PR. |
| **Tests required** | CI green on **that** SHA only; empty `git status` at tag. |
| **Estimated complexity** | S (process) / M if large rebase |
| **Dependencies** | None (starts the train) |

---

### MR-P0-002

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-002 |
| **Problem** | Production auth harness active on flag alone; bypasses storage fail-closed on committed SHA. |
| **Evidence** | `AH` R2; `RP` F-06; `QA` G-09; `REL-09`; HEAD `production-auth-harness.ts` / `production-storage-driver-assert.ts` |
| **Files** | `apps/api/src/test/production-auth-harness.ts`; `apps/api/src/storage/production-storage-driver-assert.ts`; `apps/api/src/server/production-runtime-env.ts`; `apps/api/src/tenant-kernel/auth-env.ts` |
| **Risk** | Prodlike env with harness → memory SoT / diluted integrity. |
| **Implementation plan** | Fail-closed: harness only `NODE_ENV=test`+flag; production throws if flag set; remove storage assert bypass; land WT remediation on SHA. |
| **Tests required** | Boot matrix: prod+harness=throw; test+harness=ok; prod+memory=throw (`production-auth-harness.spec.ts` on SHA). |
| **Estimated complexity** | S |
| **Dependencies** | MR-P0-001 |

---

### MR-P0-003

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-003 |
| **Problem** | `EXPECTED_PRISMA_MIGRATION_HEAD` stale vs tip; guard FAIL; boot mismatch or skipped migrates. |
| **Evidence** | `AH` R3; `DB-08`; `QA` G-10; `REL-01`; `guard-migration-head-preflight` FAIL |
| **Files** | `apps/api/src/db/migration-head-preflight.ts`; `apps/api/src/db/migration-head-preflight.spec.ts`; `apps/api/scripts/guard-migration-head-preflight.mjs` |
| **Risk** | API won’t boot after migrate **or** schema missing recon RLS / grants / reject_reason. |
| **Implementation plan** | Set constant to latest folder (`20260720140000_finance_recon_rls` or tip); fix unit hardcode; add guard to booking + deploy-critical CI. |
| **Tests required** | Guard PASS; boot after full migrate succeeds; mismatch test both directions. |
| **Estimated complexity** | S |
| **Dependencies** | MR-P0-001 |

---

### MR-P0-004

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-004 |
| **Problem** | `main` branch protection / required Booking checks unproven; deploy not gated on them. |
| **Evidence** | `AH` R7; `QA` G-11; `REL-05`; `REL-14`; `gh` unauthenticated; `deploy-vps.yml` no `needs` |
| **Files** | `scripts/ops/main-branch-required-checks.mjs`; `configure-main-branch-protection.mjs`; `.github/workflows/deploy-vps.yml`; `.github/workflows/booking-postgres-gate.yml` |
| **Risk** | Broken booking merges/deploys; “required” is aspirational. |
| **Implementation plan** | `gh auth`; apply protection with exact job names; deploy job `needs` booking+phase0/1 (or tag-only deploy). |
| **Tests required** | API dump of protection contexts; failing Booking PG blocks merge/deploy. |
| **Estimated complexity** | S–M (org access) |
| **Dependencies** | MR-P0-001; secrets for `gh` |

---

### MR-P0-005

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-005 |
| **Problem** | Production RLS boot probe omits booking/payments/recon; recon historically GRANTed before RLS. |
| **Evidence** | `DB-06`; `DB-07`; `AH` P0-10; `QA` G-07; `TENANT_RLS_TABLES` length 5 |
| **Files** | `apps/api/src/db/assert-production-database-integrity.ts`; recon migrations `20260719120000_*` / `20260720140000_*` |
| **Risk** | Boot “healthy” with money path unprotected; partial-migrate hole. |
| **Implementation plan** | Expand `TENANT_RLS_TABLES` (+FORCE) to include `operator_registrations`, `payments`, `payment_receipts`, `finance_schedules`, `finance_recon_*`, invites, etc.; never GRANT before RLS in future migrations. |
| **Tests required** | Drop RLS on `payments` → boot throw; `test:finance-recon-rls` required in CI. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-003 |

---

### MR-P0-006

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-006 |
| **Problem** | Operator hydrate ignores `sessionVersion`; header-only ingress outside production. |
| **Evidence** | `AH` R4; `RP` F-04/F-05; `QA` G-06 |
| **Files** | `apps/api/src/identity/require-operator-session.ts`; `apps/api/src/identity/hydrate-membership.ts`; `apps/api/src/tenant-kernel/tenant-kernel.ts` |
| **Risk** | Revoked admins keep operating; staging forgeable via headers. |
| **Implementation plan** | Pass JWT `sess_ver` into hydrate; reject mismatch; restrict header ingress to `NODE_ENV=test` only. |
| **Tests required** | Bump `session_version` → booking approve 401; header auth fails in `development`. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-001 |

---

### MR-P0-007

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-007 |
| **Problem** | No honest production JWT → HTTP write on Prisma (F-17 diluted / harness/memory historically). |
| **Evidence** | `AH` incorrect assumption #4; `QA` G-01; deploy checklist drift |
| **Files** | `apps/api/test/tenant-security.spec.ts`; `apps/api/test/bookings-http-postgres.spec.ts`; `docs/phase-4/production-deploy-checklist.md` |
| **Risk** | Ship without proving real prod auth path. |
| **Implementation plan** | New/extended PG suite: `NODE_ENV=production`, JWT only, prisma, real tenant row, `POST /bookings` and/or `/tours` 201; update checklist to match. |
| **Tests required** | Required CI job; header-only must 401 in that mode. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-002, MR-P0-006, Postgres in CI |

---

### MR-P0-008

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-008 |
| **Problem** | Outbox durable but effects opt-out; prod example `OUTBOX_RELAY_ENABLED=false`; VPS has no relay worker unit. |
| **Evidence** | `RP` F-12; `QA` G-04; `REL-06`; `deploy/vps/env/api.env.example` |
| **Files** | `apps/api/src/outbox/start-outbox-relay.ts`; `deploy/vps/env/api.env.example`; `deploy/argo-rollouts/outbox-relay-deployment.yaml`; systemd units |
| **Risk** | Approvals succeed; downstream never runs — silent production failure. |
| **Implementation plan** | Choose: in-process relay default true in prod **or** mandatory worker + boot fail if neither; wire VPS unit; CI effect test with relay on. |
| **Tests required** | Approve → pending → processed within SLA (required job). |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-001; deploy env change |

---

### MR-P0-009

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-009 |
| **Problem** | Payment/registration updates by primary key only; finance booking projection bypasses `BookingsService`. |
| **Evidence** | `RP` F-01/F-02/F-14; `DB-20`; `QA` G-13 |
| **Files** | `apps/api/src/workspace-finance/infrastructure/booking-payment.adapter.ts`; `apps/api/src/bookings/prisma-bookings.repository.ts`; `apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts`; `apps/api/src/boot/lazy-finance-service.ts` |
| **Risk** | Cross-tenant write if RLS/GUC wrong; second write authority without binding/capability. |
| **Implementation plan** | Always `updateMany`/`where` with `id + tenantId` (+ status CAS); route projection through booking application port (not raw `getBookingsRepository` from finance). |
| **Tests required** | Cross-tenant UUID under GUC A → 0 rows; import-boundary guard finance↛create-bookings-repository. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-005 helpful |

---

### MR-P0-010

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-010 |
| **Problem** | Binary receipt upload writes object storage before ownership check. |
| **Evidence** | `RP` F-03; `QA` G-12; `bookings.routes.ts` `handlePostBookingReceipt` |
| **Files** | `apps/api/src/bookings/bookings.routes.ts`; receipt proof storage helpers |
| **Risk** | Storage DoS / orphans / cross-booking probing. |
| **Implementation plan** | Authz/ownership before `putMemberReceiptProof`; or staging key + attach after. |
| **Tests required** | Member A → B’s bookingId: 403 and zero put (spy). |
| **Estimated complexity** | S |
| **Dependencies** | None |

---

### MR-P0-011

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-011 |
| **Problem** | Guest duplicate rule is check-then-act without DB unique constraint. |
| **Evidence** | `RP` F-07; `DB-13`; `QA` G-08; `OperatorRegistration` indexes |
| **Files** | `apps/api/prisma/schema.prisma`; `apps/api/src/bookings/prisma-bookings.repository.ts`; migration new |
| **Risk** | Duplicate active bookings under concurrency. |
| **Implementation plan** | Partial unique indexes (active statuses) for email/user/nationalId as product requires; handle P2002 on create. |
| **Tests required** | Parallel HTTP/PG creates → one win (`QA` G-08). |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-003 (migrate) |

---

### MR-P0-012

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-012 |
| **Problem** | Tenant-scoped tables with `app_tour` DML and **no RLS**: urban registrations, users, OTP, tenant_domains, role audit, outbox_replay_runs; platform tables likely over-granted. |
| **Evidence** | `DB-01`…`DB-05`; `DB-12`; `DB-19`; `QA` G-07 |
| **Files** | Migrations under `apps/api/prisma/migrations/`; `docs/phase-4/dev/init/01-app-role.sql` default privileges |
| **Risk** | Cross-tenant PII/domain takeover class; insecure-by-default new tables. |
| **Implementation plan** | ENABLE+FORCE RLS + policies per table; revoke unnecessary DML; stop blanket default privileges; CI lint grant-without-RLS. |
| **Tests required** | Adversarial `app_tour` SELECT/UPDATE cross-tenant on each table (required PG job). |
| **Estimated complexity** | L |
| **Dependencies** | MR-P0-003, MR-P0-005 |

---

### MR-P0-013

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-013 |
| **Problem** | Deploy can silent-skip without secrets; `cancel-in-progress` aborts mid-flight; every deploy runs identity bootstrap as `NODE_ENV=development`; API may start via `tsx` if dist missing. |
| **Evidence** | `REL-03`; `REL-04`; `REL-07`; `REL-08`; `deploy-vps.yml`; `bootstrap-prod-identity.sh`; `start-api.sh` |
| **Files** | `.github/workflows/deploy-vps.yml`; `scripts/vps-deploy/remote-deploy.sh`; `bootstrap-prod-identity.sh`; `start-api.sh` |
| **Risk** | False “deployed”; partial outage; prod DB touched via dev provision path; non-artifact runtime. |
| **Implementation plan** | Fail if secrets missing on main; `cancel-in-progress: false`; bootstrap only with `FORCE_BOOTSTRAP=1`; require `dist/main.js`; prefer strict SSH host keys (`REL-10`). |
| **Tests required** | Workflow contract tests / dry-run docs; systemd fails without dist. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-004 |

---

### MR-P0-014

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-014 |
| **Problem** | Rollback resets git only — DB stays forward. |
| **Evidence** | `REL-02`; `rollback-vps.sh` |
| **Files** | `scripts/vps-deploy/rollback-vps.sh`; runbooks |
| **Risk** | Code/schema split-brain after incident. |
| **Implementation plan** | Mandatory pre-migrate `pg_dump`; rollback = restore DB + code; or expand/contract only; update smoke-fail hint. |
| **Tests required** | Staging drill: migrate → rollback code-only (expect fail) → restore pair (expect ok). |
| **Estimated complexity** | M |
| **Dependencies** | Ops buy-in; MR-P0-003 |

---

### MR-P0-015

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-015 |
| **Problem** | PG cert suites can silently skip; concurrency proven at repo not HTTP; P6/DoD still memory on SHA; default `pnpm test` is anti-proof. |
| **Evidence** | `QA` G-02/G-03/G-05/G-19; `AH` R8; HTTP-PG `skip: !hasDatabase` |
| **Files** | `apps/api/test/bookings-http-postgres.spec.ts`; `scripts/p6-denali-product-gate.sh`; `apps/api/package.json` test scripts |
| **Risk** | Green CI without production SoT. |
| **Implementation plan** | Fail-closed missing DATABASE_URL for cert scripts; HTTP approve concurrency suite; P6 DoD = HTTP-PG only on SHA; release checklist bans memory as DoD. |
| **Tests required** | As listed in `QA_GAP_ANALYSIS` P0 checklist items G-02/G-03/G-05. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-001, MR-P0-004 |

---

### MR-P0-016

| Field | Content |
| ----- | ------- |
| **ID** | MR-P0-016 |
| **Problem** | Platform ops auth is shared static bearer + phone header. |
| **Evidence** | `AH` R5; `assert-platform-ops-auth.ts` |
| **Files** | `apps/api/src/platform/assert-platform-ops-auth.ts`; `read-platform-ops-bearer-token.ts` |
| **Risk** | One secret = full platform tenant/domain API. |
| **Implementation plan** | Per-operator JWT/OIDC (or short-lived signed tokens); rotate shared secret off; audit all `/platform` routes. |
| **Tests required** | Adversarial: stolen bearer without phone / wrong role; replay. |
| **Estimated complexity** | L |
| **Dependencies** | Can ship Denali customer #1 with break-glass network allowlist **only if** documented — prefer before public platform API exposure |

> **EM note:** If platform ops API is not internet-exposed on day-1, allow **temporary** mitigation (mTLS/VPN + secret rotation runbook) and keep item **P0 for public exposure**, else treat as hard P0 before prod.

---

# P1 — Fix before scaling

---

### MR-P1-001

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-001 |
| **Problem** | Only `denali` is `productionTier: certified`; Snow Leopard / peers cannot prod-provision. |
| **Evidence** | `MT` C1/C7; `AH` second customer; `WORKSPACE_PRODUCTION_CERTIFICATION` |
| **Files** | Workspace manifests; `assert-production-certified-workspace.ts`; CERT codegen |
| **Risk** | Second product blocked or shipped as stub. |
| **Implementation plan** | CERT factory (L3/L4 automation); extract shared kits from Denali; certify peers without copy-paste 7MB. |
| **Tests required** | CERT gate CI; provision fail-closed for stubs. |
| **Estimated complexity** | L |
| **Dependencies** | P0 data-plane stability |

---

### MR-P1-002

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-002 |
| **Problem** | Residual `workspaceType/pluginId === "denali"` (and urban specials) in apps. |
| **Evidence** | `MT` C6; grep hits in `resolve-validation-mode.ts`, commerce defaults, web wizard, etc. |
| **Files** | `apps/api/src/tours/*`; `apps/api/src/canonical/*`; `apps/web/src/tours/*`; guards |
| **Risk** | Second product inherits wrong rules or forces platform forks. |
| **Implementation plan** | Move to manifest/codegen; ban branches in `apps/**` via CI. |
| **Tests required** | Guard fails on new denali string in apps (allowlist generated only). |
| **Estimated complexity** | L |
| **Dependencies** | MR-P1-001 kit extraction |

---

### MR-P1-003

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-003 |
| **Problem** | Closed capability enums + role-only authz; no tenant BPM for divergent workflows. |
| **Evidence** | `MT` C2/C5; `RP` F-08; Option A off |
| **Files** | Capability codegen; `host-booking-authorization.adapter.ts`; manifests |
| **Risk** | Fake `supported: true`; per-customer Denali forks. |
| **Implementation plan** | Product taxonomy (3–5 types max); entitlements layer for 100 tenants on one type; expand modes or refuse sales; align CASL/permissions to actions. |
| **Tests required** | Entitlement matrix; capability mismatch fail-closed. |
| **Estimated complexity** | L |
| **Dependencies** | MR-P1-001 |

---

### MR-P1-004

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-004 |
| **Problem** | Data-plane fairness: global outbox claim, shared pool, capacity lock hold times, missing capacity index. |
| **Evidence** | `DB-14`; `DB-18`; `RP` F-13; `MT` C4 |
| **Files** | `outbox/outbox-relay.ts`; `prisma-bookings.repository.ts`; schema indexes |
| **Risk** | Noisy neighbor at ~100 tenants. |
| **Implementation plan** | Per-tenant claim quotas; index `(tenant_id, tour_id) WHERE approved`; pool SLOs; monitor lag. |
| **Tests required** | Flood tenant A does not starve B indefinitely. |
| **Estimated complexity** | L |
| **Dependencies** | MR-P0-008 |

---

### MR-P1-005

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-005 |
| **Problem** | `NODE_ENV!==production` skips integrity; RL-off skips Redis assert; test abort hooks reachable. |
| **Evidence** | `AH` R6; `RP` F-24; `QA` G-15 |
| **Files** | `production-runtime-env.ts`; `tenant-rate-limit-config.ts`; `test-hooks/atomic-tx-test-abort.ts` |
| **Risk** | Staging prodlike insecure; accidental abort in prod. |
| **Implementation plan** | Explicit `APP_RUNTIME_PROFILE=prodlike` integrity; forbid RL-off in production profile; hard-gate abort hooks to `NODE_ENV=test`. |
| **Tests required** | Profile matrix boot tests. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-002 |

---

### MR-P1-006

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-006 |
| **Problem** | Workspace resolve falls back to `"starter"`; urban test env override in runtime code. |
| **Evidence** | `RP` F-11; `resolve-workspace-type.ts` |
| **Files** | `apps/api/src/tenant/resolve-workspace-type.ts` |
| **Risk** | Wrong composition for missing tenants. |
| **Implementation plan** | Fail closed on missing tenant; gate overrides to test only. |
| **Tests required** | Unknown tenant → explicit error, never starter. |
| **Estimated complexity** | S |
| **Dependencies** | None |

---

### MR-P1-007

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-007 |
| **Problem** | Host package wiring + finance onboarding still human checklist; fixture package sprawl. |
| **Evidence** | `MT` duplication; finance onboarding lifecycle audit |
| **Files** | `apps/api/package.json`; workspace packages; codegen |
| **Risk** | N products = N wiring mistakes; CI/bundle bloat. |
| **Implementation plan** | Automate host dep registration; lazy load fixtures; delete obsolete finance-ws* when unused. |
| **Tests required** | Onboarding script e2e for new workspace id. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P1-001 |

---

### MR-P1-008

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-008 |
| **Problem** | Admin pool blast radius; non-prod admin fallback to app URL; SSH `StrictHostKeyChecking=no`. |
| **Evidence** | `DB-10`; `REL-10`; `getPrismaAdmin` |
| **Files** | `apps/api/src/db/prisma.ts`; `deploy-vps.yml` |
| **Risk** | Credential mix-up = global bypass; MITM deploy. |
| **Implementation plan** | Distinct roles; no fallback in staging; pin known_hosts. |
| **Tests required** | Boot fail on equal URLs; SSH mismatch fails. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-013 |

---

### MR-P1-009

| Field | Content |
| ----- | ------- |
| **ID** | MR-P1-009 |
| **Problem** | HTTP-PG edge matrix incomplete; finance atomic approve not in required booking gate; receipt ops vs member path footgun. |
| **Evidence** | `QA` G-14/G-18; `RP` F-23 |
| **Files** | `bookings-http-postgres.spec.ts`; finance PG specs |
| **Risk** | Edge regressions under scale / money path. |
| **Implementation plan** | Expand required matrices; align booking receipt authz for ops vs member. |
| **Tests required** | Table-driven edges in required CI. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-015 |

---

# P2 — Technical debt

---

### MR-P2-001

| Field | Content |
| ----- | ------- |
| **ID** | MR-P2-001 |
| **Problem** | Dual in-memory tour/booking repositories forever tempt wrong gates. |
| **Evidence** | `AH` P2; `RP` F-06 |
| **Files** | `in-memory-bookings.repository.ts`; `in-memory-tour.repository.ts` |
| **Risk** | Recurring false maturity. |
| **Implementation plan** | Isolate under `src/test/` only; production composition cannot import. |
| **Tests required** | Import boundary guard. |
| **Estimated complexity** | M |
| **Dependencies** | MR-P0-015 |

---

### MR-P2-002

| Field | Content |
| ----- | ------- |
| **ID** | MR-P2-002 |
| **Problem** | Reject without outbox; approve capacity reuses `assertCreateCapacity`; list default `view=ops`; `getOrCreateBookingRuntimeForWorkspaceType` export risk. |
| **Evidence** | `RP` F-15/F-16/F-09/F-19 |
| **Files** | `bookings.service.ts`; `create-bookings-service.ts`; parsers |
| **Risk** | Contract/UX confusion; misuse. |
| **Implementation plan** | Explicit ports/events; default deny view; internalize workspaceType entry. |
| **Tests required** | Contract tests. |
| **Estimated complexity** | S–M |
| **Dependencies** | None |

---

### MR-P2-003

| Field | Content |
| ----- | ------- |
| **ID** | MR-P2-003 |
| **Problem** | Advisory lock via truncated MD5; list+count dual TX; nullable idempotency unique NULL semantics. |
| **Evidence** | `DB-15`; `DB-17`; `RP` F-17/F-20 |
| **Files** | `prisma-bookings.repository.ts`; finance idempotency migration |
| **Risk** | Rare races / duplicate NULL-key payments. |
| **Implementation plan** | Lock table or stronger key; require idempotency keys; single-TX list optional. |
| **Tests required** | Targeted concurrency / NULL-key policy tests. |
| **Estimated complexity** | M |
| **Dependencies** | None |

---

### MR-P2-004

| Field | Content |
| ----- | ------- |
| **ID** | MR-P2-004 |
| **Problem** | Doc honesty drift (LANDED, F-17 checklist, P6 memory citations); OpenAPI drift risk; private JWT on disk. |
| **Evidence** | `AH` / `QA` / `REL-N6` |
| **Files** | phase docs; `api.env.example` |
| **Risk** | False sales/ops confidence; key theft. |
| **Implementation plan** | Doc sync to SHA; secret manager for private keys. |
| **Tests required** | Doc-gate where applicable. |
| **Estimated complexity** | S ongoing |
| **Dependencies** | MR-P0-001 |

---

### MR-P2-005

| Field | Content |
| ----- | ------- |
| **ID** | MR-P2-005 |
| **Problem** | Stress RNG + `--test-force-exit` hides flakes/hangs. |
| **Evidence** | `QA` G-16 |
| **Files** | Booking PG package scripts |
| **Risk** | Flaky release signals. |
| **Implementation plan** | Seeded RNG; release job without force-exit or with handle leak fail. |
| **Tests required** | Flake budget = 0 on release. |
| **Estimated complexity** | S |
| **Dependencies** | MR-P0-015 |

---

## Execution waves (EM schedule)

| Wave | Items | Exit criteria |
| ---- | ----- | ------------- |
| **W0 — Release floor** | P0-001…004, 013, 015 | One clean SHA; protection proven; deploy can’t silent-skip |
| **W1 — Auth + schema truth** | P0-002, 003, 005, 006, 007, 012 | Boot + JWT HTTP + RLS probe green |
| **W2 — Write path + effects** | P0-008…011, 009, 014 | Money/booking IDOR closed; relay on; rollback drill |
| **W3 — Scale readiness** | All P1 | Second product path + 100-tenant fairness |
| **W4 — Debt** | P2 | Scheduled |

**Do not start Snow Leopard product build (MT) until W0–W2 complete.**

---

## Traceability (merged ← sources)

| Master ID | Primary sources |
| --------- | ---------------- |
| P0-001 | AH R1, REL-05/15 |
| P0-002 | AH R2, RP F-06, QA G-09, REL-09 |
| P0-003 | AH R3, DB-08, QA G-10, REL-01 |
| P0-004 | AH R7, QA G-11, REL-05/14 |
| P0-005 | DB-06/07, AH P0-10, QA G-07 |
| P0-006 | AH R4, RP F-04/05, QA G-06 |
| P0-007 | QA G-01, AH F-17 |
| P0-008 | RP F-12, QA G-04, REL-06 |
| P0-009 | RP F-01/02/14, DB-20, QA G-13 |
| P0-010 | RP F-03, QA G-12 |
| P0-011 | RP F-07, DB-13, QA G-08 |
| P0-012 | DB-01…05/12/19, QA G-07 |
| P0-013 | REL-03/04/07/08/10 |
| P0-014 | REL-02 |
| P0-015 | QA G-02/03/05/19, AH R8 |
| P0-016 | AH R5 |
| P1-001…009 | MT + remaining AH/RP/QA/REL/DB |
| P2-* | leftover RP/DB/QA |

---

## EM decision record

- **Production tomorrow:** **NO**.  
- **First safe production:** After **W0–W2** on tagged SHA with artifacts.  
- **Snow Leopard / 100 heterogeneous customers:** After **W3**.  

Architect, documentation status: **Updated**. Link to docs: [`MASTER_REMEDIATION_PLAN.md`](./MASTER_REMEDIATION_PLAN.md).
