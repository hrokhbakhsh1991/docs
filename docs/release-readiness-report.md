# Backend Release Readiness Report

Date: 2026-04-30
Scope: `apps/api` (NestJS backend), runtime + migrations + infra alignment

## 1) Overview

- **Server startup:** **PASS**
  - API boots successfully in built mode (`node dist/src/main.js`), health endpoints respond.
- **Migration status:** **PASS**
  - Clean database migration run (`0 -> latest`) succeeds.
  - Re-run reports no pending migrations.
  - Normalized schema fingerprint is stable across repeated checks.
- **Docker/Infra readiness:** **PASS (for local/dev baseline)**
  - `infra/docker-compose.yml` includes PostgreSQL and Redis.
  - Health checks are present for both services.
  - Infra file is dev-oriented; production should use env-injected credentials and separate deployment manifests.
- **Observability coverage:** **PASS**
  - Webhook structured events present: `webhook_received`, `webhook_processed`, `webhook_deduplicated`, `webhook_failed`.
  - Metrics counters exposed for webhook outcomes.
- **Scheduler/Worker setup:** **PASS**
  - Runtime role model present: `APP_RUNTIME_ROLE=api|worker|all`.
  - Scheduler gating present: `ENABLE_SCHEDULERS` + `shouldRunSchedulers()`.
  - Ops health includes scheduler runtime snapshot.

## 2) API Contract Snapshot

- **Controllers:** 5
  - `auth`, `tours`, `registrations`, `payments`, `ops`
- **Routes (controller decorators):** 21 declared HTTP handlers in module controllers.
- **Swagger snapshot:** 25 path keys / 27 operations in generated `openapi.json`.
- **Swagger documentation coverage:** **~100% of exposed routes are present in OpenAPI output** (including internal webhook and ops endpoints).
- **Public endpoints still unstable / conditional:**
  - `POST /api/v2/auth/telegram/session` depends on valid Telegram-signed payloads (external dependency).
  - Public registration/waitlist endpoints are rate-limited by design; burst traffic correctly returns `429`.

## 3) Operational Checklist

- **Required env files present:** ✅
  - `apps/api/.env.staging`
  - `apps/api/.env.production`
- **JWT secrets/keys not default literals:** ⚠️
  - Files use placeholders (`REPLACE_WITH_*`) which is correct for templates, but real secrets must be injected via secret manager before deploy.
- **DB credentials not hardcoded in committed runtime env:** ⚠️
  - Template placeholders are used in staging/production env files.
  - Ensure deployment pipeline injects real credentials (do not commit real credentials).
- **`ENABLE_SCHEDULERS=false` for API runtime:** ✅
  - Set in staging/production env templates.
- **`APP_RUNTIME_ROLE` validated:** ✅
  - Set to `api` in staging/production templates.
  - Worker mode supported through runtime role and start script.

## 4) Final Verdict

**⚠️ READY WITH CONDITIONS**

Conditions before strict freeze acceptance:
1. Confirm secret injection path in staging/prod (JWT keys, DB password, internal API key).
2. Confirm production deployment separates API and Worker processes/pods.
3. Confirm infrastructure parity beyond local compose (managed DB/Redis, backups, alerting).

## 5) Recommendations (Post-freeze, Pre-production)

1. Resolve dependency security advisories (especially transitive high severity items) with coordinated upgrade plan.
2. Reduce/untangle circular dependency hot spots (`payments` <-> `registrations`; identity entity cycles) as technical debt.
3. Add explicit freeze gate CI job:
   - build
   - migration up on clean DB
   - migration re-run no-op assertion
   - OpenAPI generation diff check
4. Add operational dashboards/alerts for:
   - webhook failure rate
   - scheduler lock contention / skipped runs
   - reconciliation drift counters
5. Publish deployment runbook for API vs Worker scaling policy and rollback procedure.

