# PRODUCTION_RELEASE_AUDIT

```yaml
audit_id: PRODUCTION_RELEASE_AUDIT
role: Production Release Engineer
date: "2026-07-20"
question: "Can we deploy tomorrow?"
verdict: NO — DO NOT DEPLOY
method: CI/CD + VPS deploy scripts + env examples + migration governance + branch state (no live VPS probe)
candidate_branch: booking/capacity-concurrency-cert @ f6a820a1 (+ dirty WT)
origin_main: b79f34ef (42 commits behind this branch)
```

## Executive answer

**Do not deploy tomorrow** from either `main` or the booking branch as currently standing.

| If you deploy… | What happens |
| -------------- | ------------ |
| **`origin/main` as-is** | Misses booking PG/capacity release commits; still inherits migration-head / ops risks below. |
| **Booking SHA `f6a820a1`** | Schema tip ≠ embedded migration head → **production boot can refuse** after migrate; harness still open on SHA; branch not protected merge path. |
| **Dirty working tree** | Untested/uncommitted remediations — not a release artifact. |

Deploy automation itself has several foot-guns (silent skip, cancel-in-progress, migrate-forward / rollback-code-only).

---

## Blockers

### REL-01 — Migration head constant will break or lie about production boot

| Field | Content |
| ----- | ------- |
| **Blocker** | `EXPECTED_PRISMA_MIGRATION_HEAD` = `20260706130000_app_tour_nosuperuser` while tip migration = `20260720140000_finance_recon_rls`. `guard-migration-head-preflight` **FAIL**s. Production boot calls `assertProductionMigrationHead` after migrate. |
| **Evidence** | `apps/api/src/db/migration-head-preflight.ts`; `assert-production-database-integrity.ts`; `node apps/api/scripts/guard-migration-head-preflight.mjs` → FAIL; `remote-deploy.sh` runs `pnpm run db:migrate:deploy` then restarts API. |
| **Impact** | **Unsafe / failed boot:** fully migrated DB → `PRODUCTION_MIGRATION_HEAD_MISMATCH` → API exit 1. **Or** ops “fixes” by skipping migrates → **partial schema** (no recon RLS / outbox grants / reject_reason) while code expects them. |
| **Fix** | Sync constant to tip; make guard required on merge; document migrate→boot order; never skip migrate to “get green.” |
| **Verification** | Fresh DB migrate deploy → boot `NODE_ENV=production` succeeds; guard PASS in CI. |

---

### REL-02 — Git rollback does **not** roll back migrations (split-brain)

| Field | Content |
| ----- | ------- |
| **Blocker** | `rollback-vps.sh` only `git reset --hard` + restart services. No `prisma migrate resolve` / down migrations / schema restore. |
| **Evidence** | `scripts/vps-deploy/rollback-vps.sh`; `remote-deploy.sh` always forward `db:migrate:deploy`; smoke failure only prints rollback **hint**. |
| **Impact** | **Partial / incompatible state:** DB schema newer than rolled-back binary → boot mismatch, missing columns errors, or RLS/grant skew. Forward-only Prisma = irreversible without backup restore. |
| **Fix** | Pre-migrate snapshot (pg_dump); rollback runbook = restore DB + code together; or expand/contract migrations only. Automate “migrate only after canary boot of new binary against clone.” |
| **Verification** | Dry-run: migrate on staging → rollback code only → expect documented failure; restore drill monthly (`restore-drill-monthly.yml`) must cover this pair. |

---

### REL-03 — Deploy workflow can report success without deploying

| Field | Content |
| ----- | ------- |
| **Blocker** | `.github/workflows/deploy-vps.yml` sets `ready=false` when `VPS_HOST` / `VPS_SSH_KEY` missing and **skips** deploy steps without failing the job. |
| **Evidence** | `deploy-vps.yml` lines 23–34, 37–61 (`if: steps.vps.outputs.ready == 'true'`). |
| **Impact** | **Wrong environment behavior / false release:** “Deploy VPS” green on GitHub while production unchanged. Tomorrow’s “we deployed” may be a lie. |
| **Fix** | Fail job when secrets missing on `main` pushes (or use environment protection requiring secrets). Separate `workflow_dispatch` for dry repos. |
| **Verification** | Push to main without secrets → Actions **red**. With secrets → SSH + smoke green. |

---

### REL-04 — `cancel-in-progress: true` on production deploy

| Field | Content |
| ----- | ------- |
| **Blocker** | `deploy-vps.yml` concurrency group `deploy-vps-production` cancels in-flight deploys when a newer `main` push arrives. |
| **Evidence** | `concurrency.cancel-in-progress: true`. |
| **Impact** | **Failed / partial deployment:** mid-`pnpm install` / mid-migrate / mid-restart aborted; services stopped (`stop-stale-listeners`) then never restarted; migrate half-applied if cancel during migrate (Prisma generally transactional per migration, but deploy script is multi-step). |
| **Fix** | `cancel-in-progress: false` for production; queue deploys. |
| **Verification** | Two rapid main pushes → first completes or second waits; never leave units stopped. |

---

### REL-05 — Branch protection / required checks unproven; booking not on `main`

| Field | Content |
| ----- | ------- |
| **Blocker** | Cannot verify `main` requires Booking PG jobs. Booking work is **42 commits ahead** of `origin/main`, dirty WT remediations uncommitted. Deploy triggers on **`main` only**. |
| **Evidence** | `gh api …/protection` → auth required; `git rev-list --left-right --count origin/main...HEAD` → `0 42`; `deploy-vps.yml` `on.push.branches: [main]`; `MAIN_BRANCH_REQUIRED_CHECKS` is script-only. |
| **Impact** | **Wrong binary tomorrow:** either deploy old `main` without booking fixes, or force-push/merge without gates. |
| **Fix** | Authenticate `gh`; enforce required contexts; merge only clean SHA after gates; tag release. |
| **Verification** | Protection JSON includes Phase 0/1 + Booking PG job **names**; release tag = that SHA. |

---

### REL-06 — Production env example disables outbox relay

| Field | Content |
| ----- | ------- |
| **Blocker** | `deploy/vps/env/api.env.example` sets `OUTBOX_RELAY_ENABLED=false`. VPS systemd units = api/web/marketing/portal only — **no** outbox-relay unit (k8s argo manifest exists separately, unused by VPS path). |
| **Evidence** | `api.env.example` L18; `deploy/vps/systemd/*.service` list; `main.ts` starts relay only if enabled / worker role. |
| **Impact** | **Wrong environment behavior:** approve/booking events sit `pending` forever; finance/integration side effects silent. Looks “healthy” on port smoke. |
| **Fix** | Production default `true` **or** mandatory separate worker + boot fail if neither. Align VPS with `deploy/argo-rollouts/outbox-relay-deployment.yaml` intent. |
| **Verification** | Post-deploy: create approve → outbox row reaches terminal status within SLA. |

---

### REL-07 — Every deploy runs identity bootstrap under `NODE_ENV=development`

| Field | Content |
| ----- | ------- |
| **Blocker** | `remote-deploy.sh` always calls `bootstrap-prod-identity.sh`, which sources production `api.env` then overrides `NODE_ENV=development` to run `ProvisioningService` / seeds. |
| **Evidence** | `bootstrap-prod-identity.sh` L3, L23–32; invoked every deploy (remote-deploy L60–64). |
| **Impact** | **Unsafe production boot adjacent:** opens dev provisioning paths against prod DB URLs; idempotent seed may still mutate smoke tenants; accidental non-idempotent change = prod data drift. Also confuses “production-only” mental model. |
| **Fix** | One-time bootstrap with explicit flag; remove from steady-state deploy; use `provisionTenantProduction` + CERT only. |
| **Verification** | Redeploy twice → no unexpected tenant/user diffs; script no-ops without `FORCE_BOOTSTRAP=1`. |

---

### REL-08 — API may boot via `tsx` source if `dist/main.js` missing

| Field | Content |
| ----- | ------- |
| **Blocker** | `start-api.sh` falls back to `node --import tsx src/main.ts` when dist absent. |
| **Evidence** | `scripts/vps-deploy/start-api.sh` L14–19; comment admits tsc not green. |
| **Impact** | **Failed or wrong deploy:** compile errors at runtime; different code than CI artifact; slower cold start; path drift from “built release.” |
| **Fix** | Fail unit start if dist missing; deploy must produce `apps/api/dist/main.js`. |
| **Verification** | Delete dist → systemd fails; successful deploy → `dist/main.js` exists and is ExecStart. |

---

### REL-09 — Production auth harness still open on release candidate SHA

| Field | Content |
| ----- | ------- |
| **Blocker** | At `f6a820a1`, `APPS_API_PRODUCTION_AUTH_HARNESS=1` bypasses production storage assert. Fail-closed fix is **dirty WT only**. |
| **Evidence** | `git show HEAD:apps/api/src/test/production-auth-harness.ts`; HEAD `production-storage-driver-assert.ts` harness early return. |
| **Impact** | **Unsafe production boot:** mis-set env → memory SoT / diluted integrity while `NODE_ENV=production`. |
| **Fix** | Commit fail-closed harness; reject flag in production. |
| **Verification** | Boot with harness=1 → immediate throw; CI job on release SHA. |

---

### REL-10 — SSH deploy disables host key checking

| Field | Content |
| ----- | ------- |
| **Blocker** | `ssh … -o StrictHostKeyChecking=no` plus best-effort `ssh-keyscan`. |
| **Evidence** | `deploy-vps.yml` L47–61. |
| **Impact** | **Secrets / supply-chain:** MITM can steal deploy key traffic / inject into `/opt/app-cloud`. |
| **Fix** | Pin `known_hosts` as a GitHub secret; require strict checking. |
| **Verification** | Wrong host key → deploy fails closed. |

---

### REL-11 — Secrets & placeholder posture on VPS env files

| Field | Content |
| ----- | ------- |
| **Blocker** | Production secrets live in `/etc/app-tour/*.env` on disk; example ships `CHANGE_ME`, optional `AUTH_ALLOW_DEV_STATIC_OTP`, **private JWT key** on API host, MinIO keys, DB passwords; `remote-deploy` can `ALTER USER app_tour WITH PASSWORD` from URL. |
| **Evidence** | `api.env.example`; `sync-db-app-role-password.sh`; web/portal copy public JWT only (good) but private key in api.env. |
| **Impact** | **Wrong/unsafe env:** leftover `CHANGE_ME` → boot/connect fail; OTP fixture left on → auth bypass class; password sync scripts as root = high blast radius if env compromised. |
| **Fix** | Pre-deploy lint rejecting `CHANGE_ME` / dev OTP flags; secret manager; rotate after bootstrap. |
| **Verification** | `verify-env-coherence` + new `verify-prod-secrets-lint` fails on placeholders / forbidden flags. |

---

### REL-12 — Migrate uses admin URL; app role grants synced best-effort after

| Field | Content |
| ----- | ------- |
| **Blocker** | Order: migrate as admin → `sync-db-app-role-grants.sh` → restart. New tables can exist before grants; historical outbox grant gap already bit once (`20260720130000_outbox_events_app_cloud_grants`). |
| **Evidence** | `remote-deploy.sh` L54–58; `db-migrate-deploy.mjs` requires `DATABASE_URL_ADMIN`; outbox grants migration comment. |
| **Impact** | **Failed deployment / partial:** API up, writes fail with permission denied; pressure to point `DATABASE_URL` at superuser → **RLS bypass**. |
| **Fix** | Grant+RLS in same migration; deploy fails if `app_tour` lacks DML on critical tables; never equalize URLs. |
| **Verification** | Post-migrate probe as `app_tour`: INSERT/SELECT under GUC on bookings/outbox/payments. |

---

### REL-13 — Production integrity probes incomplete vs money path

| Field | Content |
| ----- | ------- |
| **Blocker** | Boot RLS check only 5 tables; rate limit can be disabled skipping Redis assert; staging/`NODE_ENV≠production` skips integrity. |
| **Evidence** | `TENANT_RLS_TABLES`; `assertProductionRedisUrl` early return when RL disabled; `api.env.example` has RL true (good) but easy to set false. |
| **Impact** | **Unsafe boot declared healthy** while booking/payments/urban lack FORCE RLS (see DB audit). |
| **Fix** | Expand probe; fail if RL off in production profile. |
| **Verification** | Drop RLS on `payments` → boot fails; `TENANT_RATE_LIMIT_ENABLED=false` + production → fail. |

---

### REL-14 — Booking PG CI not guaranteed before auto-deploy

| Field | Content |
| ----- | ------- |
| **Blocker** | Deploy on every `main` push; Booking PG workflow is separate. Without proven required checks, broken booking can deploy. |
| **Evidence** | `deploy-vps.yml` no `needs:` on booking-postgres-gate; protection unverified. |
| **Impact** | **Failed prod behavior** after green deploy smoke (ports up, booking wrong). |
| **Fix** | Environment rules: deploy job `needs` booking+phase0/1; or deploy only from release tags. |
| **Verification** | Failing Booking HTTP PG blocks deploy workflow. |

---

### REL-15 — Dirty tree / dual truth if someone deploys from worktree sync

| Field | Content |
| ----- | ------- |
| **Blocker** | Remediations (harness, P6 HTTP-PG, storage default) exist only in dirty WT; `sync-worktree-to-deploy.sh` pattern exists in tree. |
| **Evidence** | `git status` dirty; `scripts/vps-deploy/sync-worktree-to-deploy.sh`. |
| **Impact** | **Wrong environment:** laptop sync bypasses CI; production ≠ GitHub SHA. |
| **Fix** | Forbid worktree sync to prod; only `origin/main` / signed tags. |
| **Verification** | Deploy path asserts `git status --porcelain` empty and `HEAD` matches tag. |

---

## Non-blocking but high operational risk

| ID | Issue | Impact |
| -- | ----- | ------ |
| REL-N1 | `StrictHostKeyChecking=no` (also REL-10) | MITM |
| REL-N2 | Smoke/health can pass with relay off | Silent event lag |
| REL-N3 | Four-process smoke only if marketing+portal env exist; else weaker health-check | Partial surface untested |
| REL-N4 | Argo/HPA manifests unused by VPS path — two deploy stories | Drift |
| REL-N5 | `connection_limit=32` in example vs pool/budget code | Saturation under booking concurrency |
| REL-N6 | Private key in `api.env` | Key theft = full auth forge |

---

## Deploy path (actual)

```text
push main
  → deploy-vps.yml (may no-op if secrets missing)
  → SSH remote-deploy.sh
       → verify-db-env / maybe sync app_tour password
       → git reset --hard origin/main
       → stop listeners
       → pnpm install --frozen-lockfile
       → build-operator-vps.sh
       → ensure extensions
       → db:migrate:deploy  (DATABASE_URL_ADMIN)
       → sync-db-app-role-grants
       → bootstrap-prod-identity (NODE_ENV=development!)
       → env coherence
       → install systemd + restart
       → port wait + smoke/health + operator login
```

**Rollback path:** code SHA only → **DB stays forward** (REL-02).

---

## Go / No-Go for “deploy tomorrow”

| Criterion | Status |
| --------- | ------ |
| Clean release SHA on `main` | **NO** (42 commits out; dirty WT) |
| Migration head matches tip | **NO** |
| Branch protection proven | **NO** |
| Deploy job cannot silent-skip | **NO** |
| Rollback includes DB | **NO** |
| Outbox effects enabled in prod example | **NO** |
| Harness fail-closed on SHA | **NO** |
| Dist-only API start | **NO** |
| Bootstrap not every deploy | **NO** |

**NO-GO.**

---

## Minimum sequence before any production push

1. Commit/fix remediations; sync migration head; green `guard-migration-head-preflight`.  
2. Merge to `main` only with required Booking PG + Phase 0/1 (+ recon RLS / harness jobs).  
3. Prove branch protection via `gh`.  
4. Fix deploy workflow: no silent skip; no cancel-in-progress; `needs` gates; strict SSH.  
5. DB backup; migrate on staging; boot prodlike; enable relay or worker.  
6. Remove per-deploy dev identity bootstrap.  
7. Tag SHA; deploy tag only; document DB+code rollback pair.  

---

Architect, documentation status: **Updated**. Link to docs: [`PRODUCTION_RELEASE_AUDIT.md`](./PRODUCTION_RELEASE_AUDIT.md).
