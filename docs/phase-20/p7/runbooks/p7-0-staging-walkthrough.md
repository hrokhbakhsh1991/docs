# P7-0 — Staging deploy walkthrough (P7-0-N-001)

```yaml
nano: P7-0-N-001
epic: P7-0
authority: ../p7-0-live-infra.md
carryover: ../../phase-19/p6/runbooks/staging-deploy.md
prerequisite: pnpm run p6:gate → P6_DENALI_PRODUCT_GATE_OK
smoke_club: operator
tenant_id: 00000000-0000-4000-8000-000000000014
```

> **هدف:** اولین club مشتری روی **staging** — سه surface + API + Postgres — بدون refactor محصول.

---

## Preconditions

| Check | Command / evidence |
| ----- | ------------------ |
| P6 product gate | `pnpm run p6:gate` → `P6_DENALI_PRODUCT_GATE_OK` |
| P6 regression guards | `pnpm run guard:import-boundary` · `pnpm run guard:p3-denali-covenant` |
| Branch | `DEV` (یا release branch تأییدشده Architect) |
| Postgres | staging instance با migrations اعمال‌شده |

---

## Step 1 — Services & ports

| Service | Image / process | Port |
| ------- | --------------- | ---- |
| `@apps/api` | Node API | `4000` |
| `apps/web` | Next admin | `3000` |
| `apps/marketing` | Next public catalog | `3002` |
| `apps/portal` | Next member register + `/me` | `3003` |

Ingress باید `x-forwarded-host` را به API فوروارد کند (`/public/tenant-context`).

---

## Step 2 — Staging env matrix (required)

| Variable | App | Staging value |
| -------- | --- | ------------- |
| `DATABASE_URL` | api | Postgres connection (RLS on) |
| `PLATFORM_ROOT_DOMAIN` | api | e.g. `staging.example.com` |
| `TOUR_OPS_API_URL` | marketing, portal, web | `https://api.staging.example.com` |
| `MARKETING_PUBLIC_BASE_URL` | marketing, web | `https://{club}.staging.example.com` |
| `PORTAL_PUBLIC_BASE_URL` | marketing CTA | `https://{club}.portal.staging.example.com` |
| `ALLOW_DEV_WEB_SESSION` | web | **`false`** |
| `AUTH_ALLOW_DEV_STATIC_OTP` | api | **`false`** (real SMS on staging) |

جزئیات dev canonical hosts: [`phase-19/p6/runbooks/host-subdomain-map.md`](../../../phase-19/p6/runbooks/host-subdomain-map.md).

---

## Step 3 — DNS / TLS

برای smoke club `{club}` = `operator` (یا subdomain مشتری واقعی):

| Surface | URL pattern |
| ------- | ----------- |
| Marketing | `https://operator.{root}` |
| Portal | `https://operator.portal.{root}` |
| Admin | `https://operator.admin.{root}/auth/login` |

TLS روی هر سه surface اجباری.

---

## Step 4 — Seed (staging)

از [`first-customer-seed.md`](../../../phase-19/p6/runbooks/first-customer-seed.md):

```bash
nvm use && pnpm install
DATABASE_URL=... DATABASE_URL_ADMIN=... NODE_ENV=production \
  pnpm --filter @apps/api run db:seed
```

Verify:

- `site_surfaces`: marketing · portal · admin = `true`
- workspace definition `denali-v1` موجود
- tour فعال با id `00000000-0000-4000-8000-000000000210` (یا tour مشتری)

```bash
curl -s -H "x-forwarded-host: operator.{root}" \
  "$TOUR_OPS_API_URL/public/tenant-context" | jq .data.tenantId
# → 00000000-0000-4000-8000-000000000014 (smoke) یا tenant مشتری
```

همان `tenantId` روی portal و admin host.

---

## Step 5 — Post-deploy smoke

| # | Check |
| - | ----- |
| 1 | `node scripts/smoke-p6-host-bind.mjs` با `TOUR_OPS_API_URL` staging |
| 2 | Marketing `/tours` — tour فعال لیست شود |
| 3 | Portal OTP register (SMS واقعی) |
| 4 | Admin login + approve booking (manual VS-06/07) |
| 5 | `pnpm run p6:gate` در CI (static regression) |

Vertical slice مرجع: [`platform-denali-vertical-slice.mdoc`](../../../phase-19/platform-denali-vertical-slice.mdoc).

---

## Exit signal (P7-0-N-001)

اپراتور با URL staging لاگین می‌کند و `tenantId` روی هر سه host یکسان resolve می‌شود.

**بعدی:** [p7-0-local-stack.md](p7-0-local-stack.md) (dev) · [p7-0-env-matrix.md](p7-0-env-matrix.md) (P7-0-N-002)

```bash
pnpm run p7:gate
pnpm run p7:staging-verify   # when API is up
```
