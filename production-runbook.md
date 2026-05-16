# Production operations runbook — multi-tenant SaaS

**Audience:** DevOps / SRE / platform engineers  
**Scope:** Tour-Ops monorepo — NestJS API (`apps/api`), Next.js web (`apps/web`), PostgreSQL, Redis, subdomain-based tenancy.

**Related docs:** `docs/docs/multi-tenant-subdomain.md`, `docs/docs/observability-monitoring.md`

---

## 1. Deployment procedure

### 1.1 API deployment

1. **Freeze & verify CI:** merge only after `pnpm lint` / tests green on the release branch.
2. **Database migrations first (recommended):** run migrations against the target DB **before** or **as part of** the rolling deploy so new code never hits an older schema.
   - From build artifact or CI job with DB URL:
   ```bash
   cd apps/api && pnpm migrate:run
   ```
   - Confirm no pending migrations (your ops tooling should parse TypeORM migration table).
3. **Environment:** ensure production vars align with host-based tenancy (non-exhaustive checklist):
   - `TENANT_ROOT_DOMAIN` — apex suffix for workspaces (e.g. `app.example.com`).
   - `TRUST_PROXY_HOPS` — matches reverse-proxy depth (CDN + ingress often `2+`).
   - `CORS_ORIGIN` / `CORS_ALLOW_TENANT_SUBORIGINS=true` / `PUBLIC_WEB_ORIGIN` — CORS must use `isCorsOriginAllowed` (not open `origin: true`). See **`docs/security/production-cors-cookie-checklist.md`**.
   - `TENANT_RATE_LIMIT_HOST_PROBE_PER_IP` — throttle workspace slug enumeration on auth routes.
   - JWT keys, `DATABASE_URL`, Redis, `INTERNAL_API_KEY`, webhook secrets.
4. **Rollout:** rolling update on API pods/processes; maintain at least one healthy instance behind the load balancer.
5. **Worker (if split):** deploy `APP_RUNTIME_ROLE=worker` images after API if shared migrations; ensure schedulers/outbox config unchanged unless release notes say otherwise.

### 1.2 Web deployment

1. **Single image, global build args:** web image is tenant-agnostic (`NEXT_PUBLIC_*` only). Rebuild with correct:
   - `NEXT_PUBLIC_API_URL` **or** dynamic origin (`NEXT_PUBLIC_API_DYNAMIC_ORIGIN`, `NEXT_PUBLIC_API_PORT`).
   - `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` **must match** API `TENANT_ROOT_DOMAIN`.
   - Cookie domain / SameSite for cross-subdomain sessions (`NEXT_PUBLIC_SESSION_COOKIE_DOMAIN`, `NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE`) — same checklist doc.
2. Deploy web tier (CDN / static host / container) **after** API is compatible with the same hostname strategy (same-origin or gateway-documented split).
3. Purge CDN cache if HTML/JS caching might serve stale API origins.

### 1.3 DNS verification

Before marking deploy healthy:

| Check | Action |
|--------|--------|
| Wildcard | `*.{{TENANT_ROOT_DOMAIN}}` resolves to LB/ingress (same VIP as web or documented gateway). |
| Apex | Marketing or redirect host for `{{TENANT_ROOT_DOMAIN}}` if product requires it. |
| TLS | Certificates cover wildcard or per-tenant SANs per your strategy. |
| **Forwarded Host** | Edge sets `X-Forwarded-Host` to the **public** hostname users see; strip spoofed values from untrusted clients. |

Quick CLI checks (examples):

```bash
dig +short tenant-slug.app.example.com
curl -sI -o /dev/null -w "%{http_code}\n" https://tenant-slug.app.example.com/
```

### 1.4 Health checks

Public probes (no tenant JWT):

| Endpoint | Typical use |
|----------|-------------|
| `GET /health` | Liveness |
| `GET /health/live` | Lightweight alive |
| `GET /health/ready` / `GET /health/readiness` | Readiness (DB/dependencies as implemented) |

Internal ops (requires `X-Internal-Api-Key`):

| Endpoint | Purpose |
|----------|---------|
| `GET /internal/ops/health` | Aggregated runtime snapshot (outbox, reconciliation, payments, schedulers) |
| `GET /internal/ops/metrics/prometheus` | Prometheus-style counters (security / tenant metrics) |
| `GET /internal/ops/metrics/security` | JSON metrics snapshot |

Configure LB health checks to hit **`/health`** or **`/health/live`** — **not** tenant-scoped API routes.

---

## 2. Tenant subdomain rollout

### 2.1 Migration execution

1. **Staging:** run full migration chain on a staging DB clone; run API smoke + security E2E if available.
2. **Production:** maintenance window optional; prefer backward-compatible migrations first.
3. **Command reference:** `pnpm migrate:run` from `apps/api` with production `DATABASE_URL` (see `package.json` script `migrate:run`).

### 2.2 Subdomain backfill

The migration **`TenantSubdomain1777575000000`** adds nullable `tenants.subdomain` and a **partial unique index** on `lower(subdomain)` for active rows. Backfill is **operational**, not automatic in migration comments:

1. For each active tenant with `subdomain IS NULL`, assign a DNS-label-safe slug (`[a-z0-9-]`, length ≤ 63), lowercase.
2. Resolve collisions by appending `-` + short id suffix or numeric suffix (see migration comment block in `1777575000000-TenantSubdomain.ts`).
3. Validate against DB constraint **`chk_tenants_subdomain_format`** (see `1777575050000-TenantSubdomainFormatCheck.ts`).
4. **Do not** enable forced routing until every production tenant needed for Host login has a slug.

### 2.3 Constraint enabling

- Unique index **`uq_tenants_subdomain_active_lower`** applies once `subdomain IS NOT NULL`.
- Optional future step: **`NOT NULL`** on `subdomain` **only after** full backfill and verification (separate migration — not assumed present).

---

## 3. Incident response

### 3.1 `TENANT_HOST_UNKNOWN` spike

| Likely cause | Actions |
|---------------|---------|
| Wrong/missing DNS for new tenant | Verify wildcard record; confirm tenant row `subdomain` matches Host label. |
| `TENANT_ROOT_DOMAIN` mismatch | Compare API env to actual hostname suffix; fix and redeploy. |
| Stale edge cache | Invalidate CDN; verify `Host` / `X-Forwarded-Host` at ingress. |
| Typos / deleted tenant | Support verifies tenant exists and `deleted_at IS NULL`. |

**Metrics:** `tenant_resolution_failures_total{code="TENANT_HOST_UNKNOWN"}` and `security_events_total{event="TENANT_HOST_UNKNOWN"}` (`/internal/ops/metrics/*`).

**Example alert rules:** `docs/observability/prometheus-alerts-tenant-host.yml` (import into Prometheus/Alertmanager).

### 3.2 Authentication failures

| Pattern | Actions |
|---------|---------|
| Spike in `auth_login_failures_total` / `AUTH_LOGIN_FAILURE` | Check OTP brute-force / abuse (rate limits), wrong workspace host (phone OK but no membership), IdP/outage if applicable, clock skew on JWT. |
| `AUTH_MEMBERSHIP_DENIED` / `TENANT_SCOPE_FORBIDDEN` | Users on wrong subdomain URL; educate “correct workspace link”; verify `user_tenants` rows. |
| `AUTH_TOKEN_REVOKED` widespread | Deployment bumped `session_version` or bulk membership change; users must re-login. |

Correlate logs: structured fields `tenant_id`, `user_id`, `request_id`, `route`, `error_code`, `status_code`.

### 3.3 Database latency

1. Check DB metrics (connections, CPU, locks, replication lag).
2. API: pool exhaustion → scale connections carefully; review slow queries.
3. **RLS:** ensure session binding active; misconfigured poolers can break tenant context — follow app docs.

### 3.4 Resolver / Host failures

| Symptom | Actions |
|---------|---------|
| All tenants 403/404 on login | `TRUST_PROXY_HOPS` wrong; `X-Forwarded-Host` spoof or strip policy broken. |
| Intermittent wrong tenant | Multiple proxy hops without correct trust; fix hop count and edge headers. |

---

## 4. Monitoring checklist

### 4.1 Key metrics (Prometheus / JSON)

| Metric | Risk signal |
|--------|-------------|
| `auth_login_failures_total` | Brute force, misconfiguration, UX on wrong host |
| `tenant_mismatch_total` | Proxy/JWT/Host misalignment |
| `tenant_resolution_failures_total` (codes `TENANT_HOST_*`) | DNS, slug, reserved labels |
| `security_events_total{event="TENANT_HOST_UNKNOWN"}` | Unknown subdomain traffic |
| `security_events_total{event="TENANT_HOST_TOKEN_MISMATCH"}` | Token used on wrong workspace host |

**Endpoints:** `GET /internal/ops/metrics/prometheus`, `GET /internal/ops/metrics/security` (see `docs/docs/observability-monitoring.md`).

### 4.2 Logs

- Search by `request_id` (also returned in API error JSON).
- Filter `tenant_id` when debugging tenant-specific incidents.
- Alert on error rate by `error_code` (`TENANT_*`, `AUTH_*`).

### 4.3 Synthetic checks (optional)

- Periodic HTTPS GET to `{knownSlug}.{TENANT_ROOT_DOMAIN}` and login flow from synthetic monitoring.

---

## 5. Rollback procedure

### 5.1 Rollback migrations

1. **Prefer forward-fix:** new migration correcting bad state instead of `down`, unless emergency.
2. **TypeORM `down`:** only if tested in staging; subdomain migration **drops column** — **data loss** for `subdomain` values. Coordinate with DB snapshot.
3. After rollback, redeploy **previous** API image known compatible with schema.

### 5.2 Invalidate sessions

JWTs include `sess_ver` tied to `user_tenants.session_version`. To force global logout:

- Execute controlled **`session_version`** bump on affected rows (operational SQL/script), **or**
- Rotate JWT signing keys (major incident only — forces all clients to re-auth).

Document blast radius before bumping.

### 5.3 Restore DNS (if necessary)

1. Revert wildcard or tenant CNAME changes in DNS provider.
2. Lower TTL before risky changes next time.
3. Invalidate DNS cache cannot be forced globally — wait propagation and verify with multiple resolvers.

---

## 6. Smoke tests after deployment

Run in **staging first**, then **production** with non-destructive checks.

| # | Test | Pass criteria |
|---|------|----------------|
| 1 | **Health** | `GET /health` → 200 |
| 2 | **Login** | `POST /api/v2/auth/web/session/otp` on `{slug}.{TENANT_ROOT_DOMAIN}` with body `{"phone":"<user E.164>","otp":"<valid OTP>"}` → 200, `tenant_id` in body matches workspace |
| 3 | **Wrong tenant** | Same phone + OTP on another slug → `TENANT_SCOPE_FORBIDDEN` when user has no membership there |
| 4 | **Workspace switch** | After login A, `POST /api/v2/auth/workspace/session` on host B with membership → 200, new token `tenant_id` for B |
| 5 | **Tenant isolation** | `GET /api/v2/tours` (or tenant-scoped list) shows only current tenant; cross-tenant ID → `RESOURCE_NOT_FOUND` / no leak |

**Automated reference:** API E2E suites under `apps/api/test/e2e/` (e.g. `subdomain-comprehensive.e2e-spec.ts`, `jwt-membership-guard.e2e-spec.ts`) — adapt URLs and **phone + OTP** payloads for prod smoke tooling (never commit real OTP secrets).

### 6.1 Infrastructure closure sign-off (BFF-first + structured errors)

Run from repo root **before** marking a release that touches auth, tenancy, or ingress:

```bash
pnpm infra:signoff
```

| Gate | What it proves |
|------|----------------|
| Debt scan | No unallowlisted direct `apiClient` / legacy tenant bypass in `apps/web` |
| Ingress (code) | No browser `/api/v2` fetch in web lib |
| Ingress (example) | Sample nginx blocks public `/api/v2/` |
| API errors | `GlobalExceptionFilter` logs `error_code` on failures |
| ErrorRegistry | All canonical API codes mapped for UI |
| Log sample | Fixture (or prod drain) has `error_code` on every 4xx/5xx line |

**Staging with stack up** (fixtures `ws1-rbac` … `ws3-rbac`, static OTP only in dev/test):

```bash
pnpm infra:signoff:live
```

**Production log drain** (export JSON lines from your log platform, then):

```bash
PRODUCTION_LOG_SAMPLE=/path/to/drain.ndjson pnpm infra:signoff
```

**Ingress apply:** copy patterns from `docs/infrastructure/nginx-bff-ingress.example.conf` — browsers must hit Next.js only; Nest `/api/v2/` is internal/mesh.

**Tracing (optional):** `pnpm docker:observability` locally; in prod set `OTEL_EXPORTER_OTLP_ENDPOINT` on API. Jaeger UI: `http://localhost:16686`.

**CI:** `architecture-guardrails` runs static gates; weekly `infrastructure-closure-nightly` (+ `workflow_dispatch` → `live-gate`).

---

## Quick reference — canonical error codes (tenant/auth)

| Code | Typical HTTP |
|------|----------------|
| `TENANT_HOST_UNKNOWN` | 404 |
| `TENANT_HOST_INVALID` / `TENANT_HOST_RESERVED` | 400 / 403 |
| `TENANT_HOST_TOKEN_MISMATCH` | 403 |
| `TENANT_SCOPE_FORBIDDEN` | 403 |
| `AUTH_UNAUTHENTICATED` | 401 |

---

**Document version:** 1.1 · **Last updated:** 2026-05-17
