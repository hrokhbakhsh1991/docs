# Multi-Tenant Subdomain Architecture

This document describes **implementation-aligned** behavior for workspace routing via DNS labels (`{tenant}.{root}`), how the API resolves tenants from HTTP `Host`, how authentication interacts with that resolution, and what operators must configure locally and in production.

Canonical identifiers remain **`tenants.id` (UUID)**; **`tenants.subdomain`** is the routing slug matched against the left-most DNS label.

Related references:

- `apps/api/src/modules/tenant/tenant-host-resolver.service.ts`
- `apps/api/src/common/tenant/tenant-resolver.middleware.ts`
- `apps/api/src/common/middleware/auth.middleware.ts`
- `apps/web/lib/tour-ops-api-origin.ts`
- `apps/web/.env.local.example`

---

## 1. Architecture (text diagram)

```
                         Production-style topology
                         -------------------------

   Browser                    Reverse proxy / edge           Nest API          Postgres
   -------                    ---------------------           --------          --------
     |
     |  HTTPS GET https://acme.app.example.com/tours
     |  Host: acme.app.example.com
     |  Authorization: Bearer <JWT>
     |
     +--------------------------------------------------------------------------+
     |                                                                        |
     v                                                                        v
   Next.js (optional)                    forwards same Host + cookies       listens :443 or :3001
   OR SPA hitting API origin            strips/forges X-Forwarded-*           Trust proxy enabled
        |                                         |                               |
        |  If UI calls API on same hostname       |                               |
        +----------------------------------------+------------------------------->
                                                                |
                                                                |  Middleware chain:
                                                                |  RequestContext
                                                                |  -> TenantResolver (Host -> tenants.row)
                                                                |  -> Auth (JWT verify + Host/JWT alignment)
                                                                |  -> TenantMiddleware (trusted tenant present)
                                                                |
                                                                v
                                                         Repository queries run with
                                                         Postgres `SET LOCAL app.tenant_id`
                                                         for RLS-bound tables (JWT tenant scope).

Notes:

- **Browser → API with matching hostname** is how `Host` carries `acme`; the UI build does **not** embed `NEXT_PUBLIC_TENANT_ID`.
- **SSR / server-side fetches** in Next continue to use an explicit **`NEXT_PUBLIC_API_URL`** origin when no browser `window` exists.
- **Public participant flows** (`POST .../tours/:id/register`, etc.) resolve tenant via dedicated bootstrap logic (tour id), not via tenant hints in the client body.

```

---

## 2. Tenant resolution (API)

### 2.1 Configuration

| Variable | Role |
|----------|------|
| **`TENANT_ROOT_DOMAIN`** | If non-empty, inbound hosts must match `{label}.{TENANT_ROOT_DOMAIN}` to resolve a workspace label. Example root: `app.example.com` → tenant host `acme.app.example.com` yields label `acme`. If **empty**, host-based resolution is **disabled** (`req.tenant` stays unset for resolver purposes). |
| **`TENANT_HOST_RESERVED_SUBDOMAINS`** | Comma-separated labels that never map to a tenant (default includes `www`, `api`, `localhost`, etc.). |

Schema source: `apps/api/src/config/env.schema.ts`.

### 2.2 Which host header?

`TenantHostResolverService.extractInboundHost`:

1. **Only if `TRUST_PROXY_HOPS > 0`:** Prefer **`x-forwarded-host`** (first comma-separated entry), validated (length ≤255, no `..`, DNS-label-safe ASCII hostname structure), hostname only, lowercased. Invalid forwarded values are ignored and the resolver falls back to **`Host`** / **`req.hostname`** (spoof-resistant when trust proxy is disabled).
2. Else **`req.hostname`** (Express; respects **`trust proxy`** for downstream IP, but forwarded host is not used for tenant resolution when `TRUST_PROXY_HOPS=0`).

Therefore **`app.set("trust proxy", 1)`** in `apps/api/src/main.ts` assumes a **trusted first hop** when you enable forwarded host trust. Untrusted clients must not be able to spoof `X-Forwarded-Host` at the edge.

### 2.3 Resolver middleware

`TenantResolverMiddleware`:

- Parses label via **`parseWorkspaceTenantLabel`** on the normalized inbound host (see §2.2); reserved / invalid slug handling applies on login routes (§2.4, §7).
- Loads **`TenantEntity`** where `LOWER(subdomain) = label` and `deleted_at IS NULL`.
- Sets **`req.tenant`** on success.
- **Bypasses** the same path prefixes as health/public flows where host routing must not run (`/health`, `/internal`, `/api/docs`, public tour/register paths, etc.; auth routes are **not** bypassed so login sees `req.tenant`).

Host lookup uses TypeORM against **`tenants`**. Because this happens **before** JWT fills `RequestContext.tenantId`, the resolver runs that query inside **`RequestContextService.runWithTenantBindingSuppressed`** so Postgres **`app.tenant_id`** is not applied during this bootstrap query only.

### 2.4 Login routes vs unknown host

When **`TENANT_ROOT_DOMAIN`** is set, **`POST /api/v2/auth/web/session/otp`** and **`POST /api/v2/auth/telegram/session`**:

- Malformed / empty inbound hostname (after normalization) → **`400 TENANT_HOST_INVALID`**.
- Reserved workspace label (e.g. `www`, `api`, `admin`, `internal`, `root`) → **`403 TENANT_HOST_RESERVED`**.
- Apex / non-workspace host (no `{label}.{root}`) → **`req.tenant` unset**; **`AuthService`** responds with **`403 TENANT_CONTEXT_MISSING`**.
- Valid label but no tenant row → **`404 TENANT_HOST_UNKNOWN`**.

Login JSON has **no `tenant_id`**; web OTP sends **`phone`** + **`otp`** only; tenant scope is **only** from `Host` (or validated forwarded host when trust proxy is on). See **`docs/authentication-phone-otp.md`**.

---

## 3. Authentication flow (updated)

### 3.1 Web login (phone + OTP)

1. Client sends **`POST /api/v2/auth/web/session/otp`** with **`{ "phone": "<E.164 or normalized>", "otp": "<code>" }`** (frontend: step 1 phone, step 2 OTP).
2. **`Host`** (or forwarded host) resolves **`req.tenant`** (e.g. UI at **`http://denali.localhost:3000`** → API must see a host whose subdomain is **`denali`**).
3. API verifies OTP policy, resolves **`users`** by normalized phone match, checks **`user_tenants`** membership for **`req.tenant.id`**, issues JWT with **`tenant_id`**, **`role`**, **`sess_ver`**.

**Non-production:** OTP **`1234`** for local/tests. **`docs/authentication-phone-otp.md`** lists DB expectations (`users.phone`, `is_phone_verified`, `phone_normalized()` function).

### 3.2 Subsequent API calls

Global order in **`apps/api/src/main.ts`**:

1. **RequestContextMiddleware** — ALS store (`requestId`, `path`, `method`).
2. **TenantResolverMiddleware** — sets **`req.tenant`** when label matches.
3. **AuthMiddleware** — verifies Bearer JWT; loads **`RequestContextService`** user/tenant/role from claims; validates **`sess_ver`** against DB.

**Host ↔ JWT alignment** (when **`req.tenant`** exists):

- For almost all authenticated routes, JWT **`tenant_id`** must equal **`req.tenant.id`** or the API returns **`403 TENANT_HOST_TOKEN_MISMATCH`**.
- **Exceptions** (token exchange / discovery):
  - **`GET /api/v2/auth/workspaces`**
  - **`POST /api/v2/auth/workspace/session`**

### 3.3 Workspace switch (`POST /api/v2/auth/workspace/session`)

- Caller presents a valid JWT (**`sub`** = user).
- Body includes **`tenant_id`** for the target workspace.
- Membership is verified via **`list_user_workspaces_for_auth`**.
- When **`req.tenant`** is present (host routing), **`tenant_id` in the body must match `req.tenant.id`** (`403 TENANT_HOST_MISMATCH` otherwise). After switching hosts in the browser, the client calls this endpoint on the **target** host.

Workspace listing responses include **`tenant_subdomain`** (from migration **`list_user_workspaces_for_auth`**) so the web app can navigate to **`https://{subdomain}.{NEXT_PUBLIC_TENANT_ROOT_DOMAIN}`** before exchanging the session.

### 3.4 Frontend: single build, many tenants

- **`NEXT_PUBLIC_API_URL`**: required for **SSR/build** and as browser fallback when dynamic origin is off; must be **origin only** (no `/api/v2` suffix).
- **`NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true`**: in the browser, API base URL becomes **`window.location` hostname** plus **`NEXT_PUBLIC_API_PORT`** (or the page’s port) so the **`Host`** header on API calls matches the UI subdomain.
- **`NEXT_PUBLIC_TENANT_ROOT_DOMAIN`**: must match API **`TENANT_ROOT_DOMAIN`** for workspace navigation URLs.
- **`NEXT_PUBLIC_SESSION_COOKIE_DOMAIN`**: optional; set to **`.{parent}`** (e.g. `.example.com` or `.localhost` in dev) so the session cookie is visible across **`{slug}.{root}`** after redirects.

See **`apps/web/.env.local.example`**.

---

## 4. Security guarantees (current implementation)

| Guarantee | Mechanism |
|-----------|-----------|
| **Tenant not chosen by arbitrary JSON fields on login** | Web/Telegram session endpoints use **`Host`-resolved `req.tenant`** only; no `tenant_id` in login body. |
| **JWT scoped to a workspace** | Signed **`tenant_id`** + **`sess_ver`** tied to **`user_tenants.session_version`**; mismatch → revoke path. |
| **JWT aligned with browser workspace host** | **`TENANT_HOST_TOKEN_MISMATCH`** when **`req.tenant`** exists and JWT tenant differs (except **`/auth/workspaces`** and **`/auth/workspace/session`**). |
| **Cannot mint session for wrong host workspace** | **`TENANT_HOST_MISMATCH`** on **`workspace/session`** when host tenant ≠ body `tenant_id`. |
| **RLS isolation** | After Auth, **`TenantSessionBindingService`** sets Postgres **`app.tenant_id`** from **JWT/context** for tenant-scoped tables; policies use **`current_setting('app.tenant_id')::uuid`**. |
| **Defense in depth on reads** | Services continue to filter by tenant id from **`RequestContextService`**; unknown **`GET /api/v2/tours/:id`** in another tenant returns **`RESOURCE_NOT_FOUND`**. |

Operational caveat: **`X-Forwarded-Host`** must only be set by **trusted proxies**. If the API is exposed directly to clients, do not trust forwarded headers without additional controls.

Internal **`/internal/*`** routes (e.g. payments webhook, ops) use separate guards (signature / API key), not JWT **`Host`** alignment; webhook tenant binding is validated against persisted payment rows.

---

## 5. Local development

### 5.1 API

1. Set **`TENANT_ROOT_DOMAIN=localhost`** so **`https://{slug}.localhost`** resolves labels that exist in **`tenants.subdomain`** (modern browsers resolve `*.localhost` to loopback).
2. Seed tenants with **`subdomain`** values matching your test hosts (e.g. `owner1`, `demo`).
3. Run migrations so **`subdomain`** column and auth SQL functions exist.

### 5.2 Web + API on different ports (typical)

Example pattern:

```bash
# API: TENANT_ROOT_DOMAIN=localhost
# Web .env.local:
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true
NEXT_PUBLIC_API_PORT=3001
NEXT_PUBLIC_TENANT_ROOT_DOMAIN=localhost
NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.localhost   # optional; enables cross-subdomain cookie
```

Then browse **`http://demo.localhost:3000`** so browser calls **`http://demo.localhost:3001`** with **`Host: demo.localhost`**.

### 5.3 Automated checks

E2E coverage includes subdomain scenarios in **`apps/api/test/e2e/subdomain-multi-tenant.e2e-spec.ts`** (run via **`pnpm --filter @apps/api test:e2e`** with **`node --import tsx`** as configured in **`apps/api/package.json`**).

---

## 6. Production deployment

### 6.1 DNS

- **Wildcard** record for workspace hosts, e.g. **`*.app.example.com`** → load balancer / ingress IP (same VIP as the app or API gateway).
- Apex **`app.example.com`** can serve marketing or redirect; it does **not** carry a tenant label in the current resolver (label would be empty vs root).

### 6.2 Reverse proxy and forwarded headers

The API resolves tenant hosts via **`TenantHostResolverService.extractInboundHost`**: it prefers **`X-Forwarded-Host`** (first comma-separated entry), then Express **`req.hostname`** (requires **`trust proxy`**).

- **`TRUST_PROXY_HOPS`** (env, default **`1`**) maps to Express **`app.set('trust proxy', n)`**. Use **`0`** only if the API is reached directly by clients (no trusted proxy). Use **`2` or higher** when multiple layers (e.g. CDN → ingress → pod) sit in front of Node.
- Forward **`Host`** or set **`X-Forwarded-Host`** to the **public hostname** users see (e.g. `acme.app.example.com`).
- Strip or overwrite **`X-Forwarded-Host`** from **untrusted** clients at the edge so attackers cannot spoof workspace routing.

### 6.3 Same-origin API vs split hostnames

Preferred for **`Host`-aligned JWT checks:

- **Option A — Same site hostname:** UI and API share **`https://acme.app.example.com`** path routing (e.g. **`/api`** reverse-proxied to Nest). Browser sends one **`Host`**.
- **Option B — API subdomain:** e.g. **`api.acme.app.example.com`** requires careful **`Host`** / CORS / cookie policy so JWT alignment and cookies remain coherent; the product’s supported pattern today is **matching tenant label on the API hostname** (often implemented by dynamic browser origin + port or a unified gateway).

### 6.4 CORS (subdomains)

- **`CORS_ORIGIN`**: comma-separated **explicit** allowed origins (scheme + host + port).
- **`CORS_ALLOW_TENANT_SUBORIGINS=true`**: when **`TENANT_ROOT_DOMAIN`** is set, also allow origins whose hostname is exactly that root or is **`*.{{TENANT_ROOT_DOMAIN}}`**. In **`NODE_ENV=production`**, those origins must use **`https:`** unless the hostname is **`localhost`** or ends with **`.localhost`**.
- Prefer **`PUBLIC_WEB_ORIGIN`** for server-generated invite URLs when many tenant UI origins are allowed (workspace invites use this instead of guessing from CORS).

### 6.5 Cookies (browser session)

| Setting | Behavior |
|---------|----------|
| **`NEXT_PUBLIC_SESSION_COOKIE_DOMAIN`** | Parent domain (e.g. **`.app.example.com`**) so one cookie is visible on every `{tenant}.app.example.com` host. Omit only for single-host dev. |
| **`NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE`** | **`strict`** (default), **`lax`**, or **`none`**. **`none`** forces **`Secure=true`** (HTTPS). |
| **Secure** | Set automatically on **`https:`** pages; **`SameSite=None`** always uses **`Secure`**. |

### 6.6 Container build (web)

The web image stays **tenant-agnostic**: build args are global (`NEXT_PUBLIC_*` only). Supported args include **`NEXT_PUBLIC_API_URL`**, **`NEXT_PUBLIC_API_DYNAMIC_ORIGIN`**, **`NEXT_PUBLIC_API_PORT`**, **`NEXT_PUBLIC_TENANT_ROOT_DOMAIN`**, **`NEXT_PUBLIC_SESSION_COOKIE_DOMAIN`**, **`NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE`**, **`NEXT_PUBLIC_PAYMENT_PROVIDER`**. No per-tenant image or **`NEXT_PUBLIC_TENANT_ID`**.

---

## 7. Failure codes (quick reference)

| Code | Typical cause |
|------|----------------|
| **`TENANT_HOST_UNKNOWN`** | Subdomain label not found on **`POST .../auth/web/session/otp`** or telegram session. |
| **`TENANT_HOST_INVALID`** | Malformed or disallowed HTTP hostname (e.g. too long, `..`, invalid characters) on those login routes when host routing is enabled. |
| **`TENANT_HOST_RESERVED`** | Workspace label is a reserved name (`www`, `api`, `admin`, `internal`, `root`, etc.) on those login routes. |
| **`TENANT_CONTEXT_MISSING`** | Host routing enabled but **`Host`** is apex/root without tenant label on login. |
| **`TENANT_SCOPE_FORBIDDEN`** | Valid phone + OTP but no **`user_tenants`** row for resolved tenant (or user unknown for that phone). |
| **`TENANT_HOST_TOKEN_MISMATCH`** | Authenticated request with JWT tenant ≠ **`Host`**-resolved tenant. |
| **`TENANT_HOST_MISMATCH`** | **`POST .../auth/workspace/session`** body **`tenant_id`** ≠ **`Host`** tenant when host routing applies. |

---

## 8. Production go-live checklist

Use this before exposing multi-tenant workspaces on the public internet.

### DNS

- [ ] **`*.app.example.com`** (or your chosen **`{{tenant}}.{{TENANT_ROOT_DOMAIN}}`**) wildcard **A/AAAA** or **CNAME** → load balancer / ingress (same entrypoint as the Next app or unified gateway).
- [ ] Apex **`app.example.com`** (your **`TENANT_ROOT_DOMAIN`** host) defined for marketing or redirects if needed.
- [ ] Optional separate **`api.`** host only if architecture uses split origins; align **`Host`** / CORS / cookies accordingly.

### API (`apps/api`)

- [ ] **`TENANT_ROOT_DOMAIN`** matches the DNS suffix used by workspaces (lowercase, no leading dot).
- [ ] **`TRUST_PROXY_HOPS`** matches the number of trusted reverse-proxy layers in front of Node.
- [ ] **`CORS_ORIGIN`** lists every non-tenant apex you need (e.g. marketing site), **or** rely on **`CORS_ALLOW_TENANT_SUBORIGINS=true`** for `*.TENANT_ROOT_DOMAIN` over HTTPS.
- [ ] **`PUBLIC_WEB_ORIGIN`** set to the canonical UI base URL used in invite links (recommended when subdomain CORS is enabled).
- [ ] **`X-Forwarded-Host`** only set by infrastructure you trust.

### Web (`apps/web`)

- [ ] **`NEXT_PUBLIC_API_DYNAMIC_ORIGIN`** / **`NEXT_PUBLIC_API_PORT`** (or same-origin **`/api`** routing) so browser calls preserve tenant **`Host`**.
- [ ] **`NEXT_PUBLIC_TENANT_ROOT_DOMAIN`** equals API **`TENANT_ROOT_DOMAIN`** (workspace navigation).
- [ ] **`NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.app.example.com`** (leading dot) for cross-subdomain sessions.
- [ ] **`NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE`** chosen (`strict` vs `lax` vs `none`) for your auth UX; production HTTPS assumed.

### Docker / runtime

- [ ] **`infra/docker/Dockerfile.web`** image built once with the above **`NEXT_PUBLIC_*`** values — **no tenant UUID** in the image.
- [ ] **`infra/docker/Dockerfile.api`** unchanged per tenant; secrets via env / vault.

### Smoke tests

- [ ] **`POST /api/v2/auth/web/session/otp`** on **`https://{tenant}.app.example.com`** with a user’s **phone** + valid **OTP** → **200**.
- [ ] Same **phone** + OTP on **another** tenant host → **403** `TENANT_SCOPE_FORBIDDEN` if that user is not a member there.
- [ ] Authenticated **`GET /api/v2/tours`** (or equivalent) does not leak another tenant’s rows.
- [ ] CORS preflight from a tenant origin succeeds with credentials when enabled.

---

## 9. Phase 7 — Tenant security hardening (DNS + application)

### DNS / wildcard strategy

1. **Single wildcard to ingress** — `*.{{TENANT_ROOT_DOMAIN}}` → one load balancer; do **not** create per-tenant public DNS records. Tenant identity lives only in Postgres (`tenants.subdomain`).
2. **TLS** — wildcard cert or ACME DNS-01; include apex SAN if marketing uses `{{TENANT_ROOT_DOMAIN}}`.
3. **Ingress default deny** — nginx/ALB `server_name *.app.example.com`; `default_server` returns 444/404 for unknown hosts.
4. **Reserved labels** — never provision `www`, `api`, `admin`, etc. as workspace slugs (`TENANT_HOST_RESERVED_SUBDOMAINS`).
5. **Monitoring** — alert on `tenant_resolution_failures_total{code="TENANT_HOST_UNKNOWN"}` spikes (slug enumeration behind wildcard DNS).

### Application controls (web + API)

| Control | Behavior |
|---------|----------|
| Web Host allowlist | `@repo/tenant-host` suffix check — rejects `ws1.evil.com` (`outside_workspace`) |
| Web apex | `localhost:3000` / bare apex → `/workspace-not-found` (no login UI) |
| Web SSR | `assertWorkspaceRequest()` in root layout — hard redirect, no silent render |
| Web BFF | slug from **Host only**; ignores client `x-tenant-slug`; probes workspace before upstream |
| API strict Host | auth login + `POST /auth/workspace/session` require valid workspace Host |
| API JWT↔Host | workspace session no longer skips Host alignment |
| API CORS | `isCorsOriginAllowed` wired in `main.ts` (no `origin: true`) |
| Host probe RL | `TENANT_RATE_LIMIT_HOST_PROBE_PER_IP` on strict auth routes |

Gate: `node scripts/verify-phase-7-tenant-security.mjs`

---

## Document history

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-05-06 | Initial doc aligned with subdomain resolver, JWT/Host alignment, web dynamic origin, workspace switch, and RLS binding behavior. |
| 1.1 | 2026-05-06 | Trust proxy env, CORS tenant suborigins, invite base URL, cookie SameSite, Dockerfile web args, production checklist. |
| 1.2 | 2026-05-16 | Phase 7: DNS hardening checklist, web Host allowlist, SSR rejection, BFF hardening, CORS + host-probe rate limits. |
