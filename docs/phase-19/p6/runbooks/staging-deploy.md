# Staging deploy checklist (P6-4)

```yaml
nano: P6-4-N-006
apps: [api, marketing, portal, web]
payment_model: offline_receipt
```

## Goal

Deploy first Denali club customer on staging with **three public surfaces** + API.

---

## Platform URLs (provision subdomain `{club}`)

| Surface | URL pattern |
| ------- | ----------- |
| Marketing | `https://{club}.{root}` |
| Portal | `https://{club}.portal.{root}` |
| Admin | `https://{club}.admin.{root}/auth/login` |

Custom apex (optional): `denali.club` · `portal.denali.club` · `admin.denali.club` — `tenant_domains` table.

---

## Services

| Service | Port (typical) | Notes |
| ------- | -------------- | ----- |
| `@apps/api` | 4000 | Postgres + RLS required |
| `apps/marketing` | 3002 | `TOUR_OPS_API_URL` → API |
| `apps/portal` | 3003 | public-auth + `/me` BFF |
| `apps/web` | 3000 | operator admin |

---

## Required env (staging)

| Variable | App |
| -------- | --- |
| `DATABASE_URL` | api |
| `PLATFORM_ROOT_DOMAIN` | api |
| `TOUR_OPS_API_URL` | marketing, portal, web |
| `MARKETING_PUBLIC_BASE_URL` | marketing, web redirects |
| `PORTAL_PUBLIC_BASE_URL` | marketing CTA |
| `ALLOW_DEV_WEB_SESSION` | **false** on staging |
| `AUTH_ALLOW_DEV_STATIC_OTP` | **false** on staging |

---

## DNS / ingress

- Wildcard or per-club records for `{club}.{root}`, `{club}.portal.{root}`, `{club}.admin.{root}`
- Ingress forwards `x-forwarded-host` to API for `/public/tenant-context`
- TLS on all three surfaces

---

## Post-deploy smoke

1. `GET /public/tenant-context` on each surface host → same `tenantId`
2. Marketing `/tours` lists active tour
3. Portal registration OTP flow (real SMS)
4. Admin login + approve booking
5. `pnpm run p6:gate` in CI against staging config (static specs)

See [platform-denali-vertical-slice.mdoc](../../platform-denali-vertical-slice.mdoc).
