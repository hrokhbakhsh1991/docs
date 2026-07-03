# Host & subdomain map (P6-0)

```yaml
nano: P6-0-N-001
authority: ../../p6-host-addressing-architecture.mdoc
smoke_club: operator
smoke_tenant_id: 00000000-0000-4000-8000-000000000014
```

## Quick reference

### Platform default (provision + dev canonical)

| Surface | App | Port | Host pattern |
| ------- | --- | ---- | -------------- |
| Public | `apps/marketing` | 3002 | `{club}.{root}` |
| User | `apps/portal` | 3003 | `{club}.portal.{root}` |
| Admin | `apps/web` | 3000 | `{club}.admin.{root}` |

Dev `{root}` = `localhost`.

### Custom domain (production white-label per club)

| Surface | FQDN example | DB |
| ------- | ------------ | -- |
| Public | `denali.club` | `tenant_domains` · `surface=marketing` |
| User | `portal.denali.club` | `tenant_domains` · `surface=portal` |
| Admin | `admin.denali.club` | platform subdomain or future custom admin surface |

Clubs **do not share** apex zones. `alborz.ir` and `denali.club` are unrelated tenants.

---

## VPS staging (89.45.89.206 — P6-REM-A6)

Raw IP staging until DNS. All surfaces share tenant `00000000-0000-4000-8000-000000000014` (`operator`).

| Surface | URL | Port |
| ------- | --- | ---- |
| Admin | `http://89.45.89.206:23000` | 23000 |
| API | `http://89.45.89.206:23001/health` | 23001 |
| Marketing | `http://89.45.89.206:23002` | 23002 |
| Portal | `http://89.45.89.206:23003` | 23003 |

Host-header smoke (same as dev canonical labels):

```bash
TOUR_OPS_API_URL=http://127.0.0.1:23001 node scripts/smoke-p6-host-bind.mjs
# Host: operator.localhost · operator.portal.localhost · operator.admin.localhost
```

Env: `/etc/app-tour-staging/` · DB: `tour_db_staging` · MinIO: `app-tour-staging`

---

## Smoke club (dev)

| Surface | Canonical URL | Legacy alias (still supported) |
| ------- | ------------- | ------------------------------ |
| Marketing | `http://operator.localhost:3002` | `http://shop.operator.localhost:3002` |
| Portal | `http://operator.portal.localhost:3003` | `http://operator.localhost:3003` |
| Admin | `http://operator.admin.localhost:3000` | `http://operator.localhost:3000` |

All must resolve **same `tenantId`** (`…000014`).

Playwright marketing smoke default: `http://operator.localhost:3002/tours` (`playwright.marketing.config.ts`).

**Legacy sunset (WRS Phase 4):** `shop.{club}.localhost` remains **ingress-only** (strip before parse) — not used in smoke defaults, env examples, or redirect egress. Cutover runbook: [denali-club-cutover.md](denali-club-cutover.md).

Urban marketing smoke (SMK-MKT-05): `http://urban.localhost:3002/tours` (`playwright.marketing-urban.config.ts` · `pnpm --filter @apps/marketing run test:smoke:urban`).

---

## Dev workspace labels (non-smoke)

Additional host labels for workspace isolation during dev. **P6 catalog smoke uses `operator` only** — see [guest-slice-operator-minimal.md](guest-slice-operator-minimal.md).

| Host label | Tenant UUID | `pluginId` | Typical use |
| ---------- | ----------- | ---------- | ----------- |
| `operator` | `00000000-0000-4000-8000-000000000014` | `denali` | P6/P7 smoke · North Ridge Trek catalog |
| `denali` | `00000000-0000-4000-8000-000000000003` | `denali` | Denali admin login · wizard dev (`denali.localhost:3000`) |
| `urban` | `00000000-0000-4000-8000-000000000004` | `urban` | Urban workspace dev |

| Surface | Denali label | Urban label |
| ------- | ------------ | ----------- |
| Marketing | `http://denali.localhost:3002` | `http://urban.localhost:3002` |
| Portal | `http://denali.portal.localhost:3003` | `http://urban.portal.localhost:3003` |
| Admin | `http://denali.localhost:3000` | `http://urban.localhost:3000` |

**Note:** `denali.localhost:3002` previously returned `503 TENANT_DB_BUDGET_EXCEEDED` when catalog list fanned out parallel exposure DB ops — fixed by sequential list redaction in workspace catalog services. Prefer `operator.localhost:3002` for Denali catalog smoke when comparing against operator seed tour **North Ridge Trek**.

Catalog UI specs: [marketing-catalog-ui.md](../../../workspaces/denali/marketing-catalog-ui.md) (list + detail) · [portal-registration-ui.md](../../../workspaces/denali/portal-registration-ui.md) (register OTP + intake).

---

## `/etc/hosts` (local dev — optional)

```text
127.0.0.1 operator.localhost
127.0.0.1 operator.portal.localhost
127.0.0.1 operator.admin.localhost
127.0.0.1 denali.localhost
127.0.0.1 denali.portal.localhost
127.0.0.1 denali.admin.localhost
127.0.0.1 urban.localhost
127.0.0.1 urban.portal.localhost
# Legacy ingress-only (optional — WRS sunset):
# 127.0.0.1 shop.operator.localhost
```

---

## Ingress

| Header | Rule |
| ------ | ---- |
| `x-forwarded-host` | Preferred over `Host` (API behind BFF/ingress) |
| Resolution | `resolvePublicIngressSubdomain` → platform parse **then** `tenant_domains` |

```bash
curl -s -H "Host: operator.localhost" http://127.0.0.1:4000/public/tenant-context
curl -s -H "Host: operator.portal.localhost" http://127.0.0.1:4000/public/tenant-context
curl -s -H "Host: operator.admin.localhost" http://127.0.0.1:4000/public/tenant-context
# same tenantId in each response
```

---

## Environment variables

| Variable | Example | Used by |
| -------- | ------- | ------- |
| `TOUR_OPS_API_URL` | `http://127.0.0.1:3001` | marketing + portal BFF → API |
| `PLATFORM_ROOT_DOMAIN` | `localhost` · `example.com` | kernel parser · `buildClubSiteUrls` |
| `TENANT_ROOT_DOMAIN` | same as platform | API public ingress |
| `MARKETING_PUBLIC_BASE_URL` | `https://denali.club` | web catalog redirect · revalidate |
| `PORTAL_PUBLIC_BASE_URL` | `https://portal.denali.club` | marketing CTA when custom domain |
| `PORTAL_DEV_PORT` | `3003` | dev CTA builder |
| `ALLOW_DEV_WEB_SESSION` | `true` | dev static host → tenant map |
| `TOUR_OPS_DEV_TENANT_ID` | smoke UUID | fallback when host unmapped |

**Dev API default:** when `TOUR_OPS_API_URL` is unset and `NODE_ENV=development`, `resolveTourOpsApiBaseUrl()` falls back to `http://127.0.0.1:3001`. Templates are **tracked in git** (`!.env.local.example` in root `.gitignore`): `apps/marketing/.env.local.example` · `apps/portal/.env.local.example`.

---

## Full local stack (Postgres + Denali tenant)

For real catalog data on tenant `…000003` (not operator smoke seed):

```bash
docker compose -f infra/docker-compose.yml up -d postgres
cd apps/api && pnpm run dev                    # copy apps/api/.env.local.example → .env.local (DATABASE_URL)
pnpm --filter @apps/marketing run dev          # :3002
pnpm --filter @apps/portal run dev             # :3003
```

| Step | URL |
| ---- | --- |
| Browse tours | `http://denali.localhost:3002/tours` |
| Register | `http://denali.portal.localhost:3003/catalog/{activeTourId}/register` |
| Member list (after intake) | `http://denali.portal.localhost:3003/me/registrations` |

Tours list only when canonical `publishStatus === "active"`. Dev OTP: API log `otp-dev delivery` or `AUTH_ALLOW_DEV_STATIC_OTP=true`.

---

## CTA flow (marketing → portal)

```text
Marketing detail CTA
  → resolveWebRegistrationUrl(host, tourId, pluginId)
  → buildDevPortalPublicBaseUrl({ ingressHost, rootDomain, portalPort, configuredBaseUrl? })
  → {portalOrigin}/catalog/{tourId}/register
```

Custom domain prod: set `PORTAL_PUBLIC_BASE_URL=https://portal.denali.club`.

---

## Workspace vs tenant

| Question | Answer |
| -------- | ------ |
| Does `denali.club` mean workspace Denali? | **No** — it means **tenant** bound to that domain; plugin may be `denali` or `urban` from registry |
| Do clubs see each other? | **No** — separate `tenantId`, RLS, domains |
| Who sets plugin? | `tenants` row + `workspace_definitions` — not hostname |

---

## Provision URLs (platform create-club)

After Super Admin provisions subdomain `my-club`:

```text
https://my-club.example.com              marketing
https://my-club.portal.example.com       portal
https://my-club.admin.example.com/auth/login   admin
```

Customer may later attach `tenant_domains` for `myclub.ir` apex.

---

## Verify checklist

```text
□ tenant-kernel multi-level parse specs green
□ p6-host-tenant-parity.spec.ts green (P6-0-N-002)
□ smoke-p6-host-bind.mjs exits 0 (P6-0-N-007)
□ operator.localhost CTA lands on portal register route
□ operator.admin login resolves same tenant as marketing
□ denali.localhost:3002 + denali.portal.localhost:3003 resolve tenant …000003 (Postgres dev)
□ guard:public-catalog-m17 green (dynamic count)
```

---

## See also

- [p6-host-addressing-architecture.mdoc](../../p6-host-addressing-architecture.mdoc)
- [guest-slice-operator-minimal.md](guest-slice-operator-minimal.md)
- [marketing-catalog-ui.md](../../../workspaces/denali/marketing-catalog-ui.md) · [portal-registration-ui.md](../../../workspaces/denali/portal-registration-ui.md)
- [platform-domains-ssl.mdoc](../../../phase-15/platform-domains-ssl.mdoc)
