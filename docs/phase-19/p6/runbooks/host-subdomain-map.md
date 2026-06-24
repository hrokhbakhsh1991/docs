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

---

## `/etc/hosts` (local dev — optional)

```text
127.0.0.1 operator.localhost
127.0.0.1 operator.portal.localhost
127.0.0.1 operator.admin.localhost
127.0.0.1 shop.operator.localhost
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
| `PLATFORM_ROOT_DOMAIN` | `localhost` · `example.com` | kernel parser · `buildClubSiteUrls` |
| `TENANT_ROOT_DOMAIN` | same as platform | API public ingress |
| `MARKETING_PUBLIC_BASE_URL` | `https://denali.club` | web catalog redirect · revalidate |
| `PORTAL_PUBLIC_BASE_URL` | `https://portal.denali.club` | marketing CTA when custom domain |
| `PORTAL_DEV_PORT` | `3003` | dev CTA builder |
| `ALLOW_DEV_WEB_SESSION` | `true` | dev static host → tenant map |
| `TOUR_OPS_DEV_TENANT_ID` | smoke UUID | fallback when host unmapped |

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
□ shop.operator CTA lands on portal register route
□ operator.admin login resolves same tenant as marketing
```

---

## See also

- [p6-host-addressing-architecture.mdoc](../../p6-host-addressing-architecture.mdoc)
- [guest-slice-operator-minimal.md](guest-slice-operator-minimal.md)
- [platform-domains-ssl.mdoc](../../../phase-15/platform-domains-ssl.mdoc)
