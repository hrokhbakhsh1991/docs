# DATABASE_SECURITY_AUDIT

```yaml
audit_id: DATABASE_SECURITY_AUDIT
role: PostgreSQL Security Specialist — Hostile Review
date: "2026-07-20"
threat_model: malicious Tenant A (compromised app path, confused-deputy, or SQLi-equivalent raw access as role app_tour)
method: migration SQL + Prisma schema + runtime RLS helpers (no live cluster probe in this pass)
latest_migration_folder: 20260720140000_finance_recon_rls
embedded_migration_head: 20260706130000_app_tour_nosuperuser
```

## Executive verdict

**FAIL — not ready for a hostile multi-tenant security audit.**

RLS + `FORCE ROW LEVEL SECURITY` is real and correctly patterned on many money/booking tables, but:

1. Several **tenant-scoped tables have DML grants to `app_tour` with zero RLS**.
2. **Boot integrity only probes 5 tables** — booking/payments/recon are invisible to the production RLS assert.
3. **Migration head constant is 14+ migrations behind** — governance cannot tell “fully migrated” from “partially migrated.”
4. **Concurrency safety for guest duplicate bookings is application-only** (no unique constraint).
5. **Admin/superuser path intentionally bypasses RLS** for outbox/registry; any URL mix-up collapses isolation.

Assume Tenant A can cause the API process to run SQL as `app_tour` (bug, injection, or stolen pool). Everything below is evaluated under that assumption.

---

## Policy pattern (baseline — what works)

Most isolation policies are:

```sql
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
```

Session GUC is set transaction-locally via `set_config(..., true)` in `applyTenantRlsSessionVars` (`apps/api/src/db/rls-session-vars.ts`).

`FORCE ROW LEVEL SECURITY` is present on the major booking/finance/outbox tables — table owner cannot casually skip policies (superuser / `BYPASSRLS` still can).

`app_tour` is migrated to `NOSUPERUSER NOBYPASSRLS` (`20260706120000`, `20260706130000`).

---

## Issues

### DB-01 — `urban_registrations`: full app DML, **no RLS**

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** |
| **Attack scenario** | **1 / 2** — Tenant A reads or updates Tenant B urban waitlist/confirmed rows (`email`, `phone`, `payload`). |
| **Evidence** | Table created in `20260608100000_urban_product_delta/migration.sql` with indexes/unique — **no** `ENABLE ROW LEVEL SECURITY`. No later migration adds RLS. `app_tour` receives DML via `01-app-role.sql` `GRANT … ON ALL TABLES` + `ALTER DEFAULT PRIVILEGES`. |
| **Impact** | Classic multi-tenant breach on urban product data. Application `WHERE tenant_id = ?` is the **only** control — any missing filter is a full cross-tenant leak/write. |
| **Fix plan** | `ENABLE` + `FORCE` RLS; tenant isolation policy (USING + WITH CHECK); verify grants remain. Backfill: confirm no cross-tenant orphans. |
| **Test required** | As `app_tour`: set GUC to A, `SELECT`/`UPDATE` B’s `id` → 0 rows. Without GUC → 0 rows. Integration: urban registration IDOR suite. |

---

### DB-02 — `users` + `mobile_otp_challenges`: global PII/OTP tables, **no RLS**

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** |
| **Attack scenario** | **1** — Tenant A enumerates all mobiles in `users`; reads/updates OTP challenges for any phone (`mobile_otp_challenges`). |
| **Evidence** | `20260609100000_identity_production_delta/migration.sql` creates both tables; RLS only on `user_tenants`. Explicit `GRANT … ON users TO app_tour` in `20260609110000_operator_bookings_delta`. Identity repo uses bare `getPrisma().user.*` / `mobileOtpChallenge.*` **without** `withTenantRls` (`prisma-identity.repository.ts`). |
| **Impact** | Platform-wide phone directory + OTP oracle if any identity path is abusable. Cross-tenant identity correlation. |
| **Fix plan** | Prefer: OTP/user access only via security-definer functions; or RLS keyed by hash/purpose; revoke direct table DML from `app_tour` where possible. At minimum: deny `SELECT` of all users except by primary key through controlled APIs + auditing. |
| **Test required** | `SELECT count(*) FROM users` as `app_tour` must fail or return 0 without privileged function. OTP row for victim mobile unreadable under attacker session. |

---

### DB-03 — `tenant_domains`: granted to `app_tour`, **no RLS**

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** |
| **Attack scenario** | **1 / 2** — Tenant A lists all custom hostnames; inserts/updates B’s domain → routing/SSL takeover class attacks. |
| **Evidence** | `20260621100000_tenant_domains/migration.sql`: `CREATE TABLE` + `GRANT SELECT, INSERT, UPDATE, DELETE … TO app_tour` — **no RLS**. |
| **Impact** | Cross-tenant domain metadata leak; malicious `hostname` rows can steal traffic if edge trusts DB. |
| **Fix plan** | RLS + FORCE; ideally revoke DML from `app_tour` and allow only admin/ops role for domain mutations. |
| **Test required** | App role cannot `SELECT` other tenants’ domains; cannot `INSERT` domain for foreign `tenant_id`. |

---

### DB-04 — `operator_user_role_audit`: tenant column, **no RLS**

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **1** — Tenant A reads role-change audit for Tenant B (who was promoted/demoted). |
| **Evidence** | `20260610100000_operator_user_role_audit/migration.sql` — table + index on `tenant_id`; no RLS migration. Covered by blanket grants. |
| **Impact** | Sensitive ops intelligence leak across tenants. |
| **Fix plan** | ENABLE/FORCE RLS + isolation policy; or revoke SELECT from `app_tour` (admin-only audit). |
| **Test required** | Cross-tenant SELECT by `id` returns 0 under app role + GUC A. |

---

### DB-05 — `outbox_replay_runs`: granted, **no RLS**

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **1** — Tenant A reads replay run `details` / `requested_ids` (may include foreign event IDs); inserts fake replay audit noise. |
| **Evidence** | `20260719130000_outbox_replay_runs/migration.sql`: `GRANT SELECT, INSERT ON TABLE outbox_replay_runs TO app_tour`; nullable `tenant_id`; **no RLS**. |
| **Impact** | Ops audit contamination; possible cross-tenant event ID disclosure. |
| **Fix plan** | RLS when `tenant_id IS NOT NULL`; deny app inserts (admin-only); or revoke grants to `app_tour`. |
| **Test required** | App role cannot read runs for other tenants; cannot insert without admin. |

---

### DB-06 — Finance recon: **GRANT before RLS** (migration window + drift)

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** for any DB that applied `20260719120000` but not `20260720140000` |
| **Attack scenario** | **1 / 2 / 5** — Between recon table creation and RLS migration, `app_tour` has full DML with **no policies**. Tenant A reads/writes B’s recon findings/actions. |
| **Evidence** | `20260719120000_finance_recon_findings/migration.sql` grants DML immediately. `20260720140000_finance_recon_rls/migration.sql` later ENABLE/FORCE + policies (comments admit the hole). |
| **Impact** | Environments that stop mid-migrate (or pin old head) are wide open on recon tables. |
| **Fix plan** | Never GRANT before RLS in same migration; squash/repair: assert RLS before grant in deploy checklist; expand boot probe to include these tables. |
| **Test required** | Migrate-stop after 19120000 → adversarial SELECT succeeds (proves hole). After 20140000 → fails. CI must refuse “grant without relrowsecurity”. |

---

### DB-07 — Production RLS boot probe **omits** booking/payments/recon

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** |
| **Attack scenario** | **5 / 6** — Operator ships DB missing FORCE RLS on `operator_registrations` / `payments`; API still boots because probe only checks 5 tables. |
| **Evidence** | `TENANT_RLS_TABLES` in `apps/api/src/db/assert-production-database-integrity.ts` = `tours`, `outbox_events`, `audit_events`, `http_idempotency_records`, `processed_domain_events` only. |
| **Impact** | False sense of isolation; money/booking path can be unprotected while “production integrity” passes. |
| **Fix plan** | Expand probe to all tenant tables with `tenant_id` (at least registrations, payments, receipts, schedules, recon, invites, settings). Fail if any missing FORCE. |
| **Test required** | Drop RLS on `payments` in test DB → boot must throw `PRODUCTION_DATABASE_RLS_NOT_APPLIED:payments`. |

---

### DB-08 — Migration head constant **stale** (governance broken)

| Field | Content |
| ----- | ------- |
| **Severity** | **Critical (P0)** |
| **Attack scenario** | **5** — Drift between binary and schema: either boot refuses healthy DB, or ops “fixes” by skipping migrates → missing recon RLS / outbox grants / reject_reason. |
| **Evidence** | `EXPECTED_PRISMA_MIGRATION_HEAD = "20260706130000_app_tour_nosuperuser"` vs tip `20260720140000_finance_recon_rls`. `guard-migration-head-preflight.mjs` **FAIL**s on current tree. Head check uses `ORDER BY finished_at DESC LIMIT 1` (not topological migration order). |
| **Impact** | Cannot prove production schema matches code. Classic “we thought RLS shipped.” |
| **Fix plan** | Sync constant; make guard merge-blocking; prefer checksum of applied migration set, not single latest `finished_at`. |
| **Test required** | Guard green only when constant == latest folder; boot mismatch test both directions. |

---

### DB-09 — `outbox_events` DML grant landed **late**

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **5 / 6** — Empty/partial DB: RLS on outbox without GRANT → app cannot write events (availability). Ops “fix” by pointing `DATABASE_URL` at admin/superuser → **RLS bypass for all tables**. |
| **Evidence** | `20260720130000_outbox_events_app_tour_grants/migration.sql` comment: phase4 created outbox without grants to `app_tour`. |
| **Impact** | Pressure to run API as bypass role; total tenant isolation collapse. |
| **Fix plan** | Pair GRANT+RLS in creating migration; refuse production boot if app role is superuser/BYPASS (partially exists) **and** if critical grants missing. |
| **Test required** | Fresh migrate → `app_tour` can INSERT outbox under GUC; cannot SELECT other tenant. Superuser URL rejected at boot. |

---

### DB-10 — Admin pool / table owner bypass (by design, high blast radius)

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **1 / 2 / 6** — `DATABASE_URL_ADMIN` equals `DATABASE_URL`, or non-prod `getPrismaAdmin()` falls back to app URL that is actually superuser; outbox claim + tenant registry see all rows. |
| **Evidence** | `claimPendingOutboxBatch` uses `getPrismaAdmin()` (`outbox-relay.ts`). `getPrismaAdmin` non-production falls back to `getPrisma()` (`prisma.ts`). FORCE RLS does **not** stop superuser/`BYPASSRLS`. |
| **Impact** | Single credential mistake = global read/write. |
| **Fix plan** | Production: distinct roles (`app_tour` NOBYPASS vs `app_tour_admin` BYPASS only for claim/migrate); network isolate admin; never fallback in staging. |
| **Test required** | Boot fails when URLs equal; staging forbids admin fallback; claim works only on admin role. |

---

### DB-11 — Policy uses `current_setting(..., true)` (missing_ok)

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** as configured; **High** if GUC can be attacker-controlled to victim UUID |
| **Attack scenario** | **1 / 2** — Confused deputy sets `app.current_tenant_id` to B while executing A’s request (ALS mismatch is app-checked only when ALS bound). Empty/invalid GUC → cast errors / no rows. |
| **Evidence** | All sampled policies use `current_setting('app.current_tenant_id', true)::uuid`. `assertActiveTenantMatchesRlsTarget` no-ops when ALS unset (`assert-tenant-rls-alignment.ts`). |
| **Impact** | Isolation equals “whoever set the GUC last on this connection.” Connection pooling bugs = cross-tenant. |
| **Fix plan** | Prefer `set_config` + `current_setting(..., false)` inside same TX only; RESET GUC in `finally`; consider `SET LOCAL` via transaction attributes; fail closed if GUC null on DML. |
| **Test required** | Pool reuse: TX1 tenant A commit, TX2 without set_config must see 0 rows; ALS mismatch throws. |

---

### DB-12 — Default privileges auto-grant DML on **new** tables

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **5 / 6** — Engineer adds tenant table, forgets RLS; `ALTER DEFAULT PRIVILEGES … GRANT … TO app_tour` (`01-app-role.sql`) makes it immediately readable/writable. |
| **Evidence** | `docs/phase-4/dev/init/01-app-role.sql` lines 13–14, 29. Recon (DB-06) is the lived example. |
| **Impact** | Structural footgun: insecure-by-default for every future migration. |
| **Fix plan** | Default privileges → **no** DML; grant per-table only after RLS FORCE; CI policy lint. |
| **Test required** | New table without RLS → CI fails; `app_tour` has no privilege until grant migration. |

---

### DB-13 — Duplicate booking races: **no unique constraint** on guest identity

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **3** — Tenant A (or guests) double-submit; two concurrent inserts both pass `findActiveGuestDuplicate` then insert. Capacity/advisory lock does **not** cover duplicate guest rule. |
| **Evidence** | `OperatorRegistration` indexes: `(tenant_id, status, submitted_at)`, `(tenant_id, tour_id, submitted_at)` only — **no** unique on email/user/nationalId (`schema.prisma`). Urban has `uq_urban_reg_tenant_tour_email`; operator bookings do not. |
| **Impact** | Duplicate active bookings; capacity accounting skew; payment/receipt fan-out. |
| **Fix plan** | Partial unique indexes for active statuses (e.g. email lower, submitted_by, intake nationalId); handle `P2002` in create. |
| **Test required** | Parallel inserts same `(tenant, tour, email)` → one success, one unique violation. |

---

### DB-14 — Capacity aggregate index mismatch (slowdown / lock hold time)

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** — availability / **3** amplification |
| **Attack scenario** | **4** — Under load, `sum(party_size) WHERE tenant_id AND tour_id AND status='approved'` cannot use ideal index; holds `pg_advisory_xact_lock` longer → approve queue DoS for that tour. |
| **Evidence** | Aggregate in `sumApprovedPartySizeInTx` (`prisma-bookings.repository.ts`). Indexes lack `(tenant_id, tour_id, status)`. |
| **Impact** | Latency spikes; timeout cascades; apparent “deadlock” / pool exhaustion. |
| **Fix plan** | Add `CREATE INDEX … ON operator_registrations (tenant_id, tour_id) WHERE status = 'approved'` (or include `status`). |
| **Test required** | `EXPLAIN ANALYZE` under volume; approve p99 under concurrent creates. |

---

### DB-15 — Advisory lock key is truncated MD5 (collision class)

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** |
| **Attack scenario** | **3** — Distinct `(tenant, tour)` pairs hash to same two `int4` lock IDs → false serialization **or** (worse) if logic ever assumed uniqueness beyond lock, subtle races across tours. |
| **Evidence** | `acquireTourCapacityLock`: `md5(tenantId||':'||tourId)` → two 32-bit ints (`prisma-bookings.repository.ts`). Transaction-scoped; READ COMMITTED. |
| **Impact** | Rare cross-tour blocking; theoretical under-isolation if combined with buggy non-locked writers (memory path). |
| **Fix plan** | Lock on dedicated row (`tour_capacity_locks`) with `SELECT … FOR UPDATE`, or hash to 64-bit single-key API carefully documented. |
| **Test required** | Crafted collision pairs (if found) must still preserve per-tour occupancy correctness. |

---

### DB-16 — Isolation level: READ COMMITTED + check-then-act elsewhere

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** |
| **Attack scenario** | **3** — Writers that skip advisory lock (memory repo, future raw SQL) observe stale occupancy under READ COMMITTED. |
| **Evidence** | Prisma default isolation; capacity safety depends on **everyone** taking `pg_advisory_xact_lock` then re-reading sum. In-memory repository has **no** equivalent. |
| **Impact** | Overbooking when any writer bypasses lock protocol. |
| **Fix plan** | DB-enforced capacity (exclusion constraint / lock table); ban memory in prod; serialize all occupancy writers. |
| **Test required** | Two sessions without lock → demonstrate overbook; with lock → refuse. |

---

### DB-17 — Unique indexes on nullable idempotency keys (PostgreSQL NULL semantics)

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** |
| **Attack scenario** | **3** — Parallel manual payment creates with **NULL** `creation_idempotency_key` both succeed (UNIQUE allows multiple NULLs). |
| **Evidence** | `20260718210000_finance_idempotency_lease_and_creation_keys/migration.sql`: `UNIQUE (tenant_id, creation_idempotency_key)` and receipts hash unique — standard PG NULL behavior. |
| **Impact** | Duplicate payments/receipts when client omits idempotency key. |
| **Fix plan** | Partial unique `WHERE creation_idempotency_key IS NOT NULL`; require key on create API; or use sentinel. |
| **Test required** | Two NULL-key creates → if product forbids, DB must block or API must require key. |

---

### DB-18 — Outbox claim index vs predicate shape

| Field | Content |
| ----- | ------- |
| **Severity** | **Medium (P2)** |
| **Attack scenario** | **4** — Global claim `WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED` can degrade as table grows; relay lag → business timeouts. |
| **Evidence** | Partial index `outbox_events_pending_created_at_idx` on `(created_at) WHERE status='pending'` (`20260605190000`). Also `(tenant_id, status, created_at)`. Ordered-per-tenant mode uses correlated `NOT EXISTS` (heavier). |
| **Impact** | Production slowdown / SKIP LOCKED contention under multi-tenant flood (Tenant A can generate pending spam affecting claim latency for all if single relay). |
| **Fix plan** | Partition/limit per-tenant claim quotas; keep partial index; monitor bloat; separate poison queues. |
| **Test required** | Explain claim at 1e6 pending; Tenant A flood must not starve B indefinitely (fairness policy). |

---

### DB-19 — Platform / catalog tables shared without tenant RLS

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** for writable ones; **Low** for true globals |
| **Attack scenario** | **1 / 2 / 6** — If `app_tour` can `UPDATE tenants` / `platform_ops_users` / `tenant_subscriptions`, Tenant A escalates to platform. |
| **Evidence** | No RLS migrations for `tenants`, `platform_ops_users`, `platform_plans`, `tenant_subscriptions`, `workspace_definitions`, `tenant_routes`. Blanket grants may apply via ALL TABLES. |
| **Impact** | Privilege escalation beyond tenant sandbox. |
| **Fix plan** | Revoke DML on platform tables from `app_tour`; use admin role only; RLS where tenant-owned. |
| **Test required** | `\dp` audit: `app_tour` privileges on platform tables = SELECT none or minimal. Attempted UPDATE tenants → permission denied. |

---

### DB-20 — `payments` / registration updates rely on RLS alone for IDOR

| Field | Content |
| ----- | ------- |
| **Severity** | **High (P1)** |
| **Attack scenario** | **2** — Tenant A guesses UUID of B’s payment/registration; if GUC wrongly set to B (deputy) or RLS off (DB-07), `UPDATE … WHERE id = $victim` succeeds. App often uses `where: { id }` after tenant find. |
| **Evidence** | Schema PKs are global UUIDs; composite `@@unique([tenantId, id])` on tours but registrations/payments use single UUID PK. Runtime path audit: update-by-id patterns. |
| **Impact** | Cross-tenant write when defense-in-depth missing. |
| **Fix plan** | Composite keys or always `WHERE id AND tenant_id`; DB triggers preventing tenant_id change. |
| **Test required** | Under correct GUC A, update B’s id → 0 rows; trigger blocks `tenant_id` mutation. |

---

## Attack scenario coverage matrix

| # | Scenario | Primary issues |
| - | -------- | -------------- |
| 1 | A reads B | DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-19 |
| 2 | A updates B | DB-01, DB-03, DB-06, DB-10, DB-20 |
| 3 | Duplicate races | DB-13, DB-15, DB-16, DB-17 |
| 4 | Missing indexes / slowdown | DB-14, DB-18 |
| 5 | Migration drift | DB-06, DB-07, DB-08, DB-09, DB-12 |
| 6 | Unsafe roles | DB-10, DB-09, DB-12, DB-19 |

---

## Tables with RLS+FORCE (inventory)

Confirmed via migrations (non-exhaustive names):  
`tours`, `outbox_events`, `audit_events`, `http_idempotency_records`, `processed_domain_events`, `operator_registrations`, `payments`, `payment_receipts`, `user_tenants`, `operator_pending_invites`, `finance_schedules`, `finance_recon_*` (after 20140000), settings/draft/exposure/integration/telegram tables listed in migration grep.

## Tables of concern **without** RLS (non-exhaustive)

| Table | `app_tour` access | Risk |
| ----- | ----------------- | ---- |
| `urban_registrations` | Yes (blanket) | Cross-tenant PII |
| `users` | Explicit GRANT | Global phone book |
| `mobile_otp_challenges` | Blanket | OTP oracle |
| `tenant_domains` | Explicit GRANT | Domain takeover class |
| `operator_user_role_audit` | Blanket | Audit leak |
| `outbox_replay_runs` | Explicit GRANT | Ops leak |
| `tenants` / platform_* | Likely blanket | Escalation |

---

## Positive controls (do not treat as “done”)

- FORCE RLS on core booking/payment/outbox tables when migrations fully applied.
- `app_tour` NOSUPERUSER NOBYPASSRLS migrations exist.
- Partial index for pending outbox claim.
- Urban email uniqueness (urban only) — shows the pattern operator bookings lack.
- Transaction-local `set_config` for GUC (correct direction).

---

## Recommended verification battery (no fixes in this pass)

```sql
-- As app_tour, after SET LOCAL app.current_tenant_id = '<A>':
SELECT * FROM operator_registrations WHERE tenant_id = '<B>';  -- expect 0
SELECT * FROM payments WHERE id = '<B_payment>';               -- expect 0
SELECT * FROM urban_registrations;                             -- expect FAIL or 0 (today: LEAK)
SELECT mobile FROM users;                                      -- expect FAIL (today: LEAK)
SELECT * FROM tenant_domains;                                  -- expect FAIL (today: LEAK)

-- Role:
SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_tour';
-- expect f, f

-- Catalog:
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;
```

Plus: run `guard-migration-head-preflight` (currently FAIL); expand integrity probe tests.

---

**Sign-off:** Hostile DB review — **do not ship** multi-tenant production until P0s (DB-01…DB-03, DB-06…DB-08) are closed and proven on a live cluster with `app_tour`.

Architect, documentation status: **Updated**. Link to docs: [`DATABASE_SECURITY_AUDIT.md`](./DATABASE_SECURITY_AUDIT.md).
