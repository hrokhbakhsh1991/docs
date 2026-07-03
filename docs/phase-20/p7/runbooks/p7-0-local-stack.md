# P7-0 — Local four-service stack (dev parity before staging)

```yaml
nano: P7-0-N-001
companion: p7-0-staging-walkthrough.md
smoke_club: operator
tenant_id: 00000000-0000-4000-8000-000000000014
```

> **هدف:** همان vertical slice P6 روی لپ‌تاپ — قبل از deploy staging.

---

## 1. Infra

```bash
```bash
cd "$(git rev-parse --show-toplevel)"   # repo root
nvm use && corepack enable
pnpm run infra:up           # Postgres :5434 · Redis · MinIO
pnpm run db:migrate:deploy  # uses apps/api/.env.local
pnpm --filter @apps/api run db:seed
```

---

## 2. `/etc/hosts`

```text
127.0.0.1 operator.localhost operator.portal.localhost operator.admin.localhost
```

---

## 3. Start services (four terminals)

| App | Command | URL |
| --- | ------- | --- |
| API | `pnpm --filter @apps/api run dev` | `http://127.0.0.1:3001` (check `PORT` in `.env.local`) |
| Admin | `pnpm --filter @apps/web run dev` | `http://operator.admin.localhost:3000` |
| Marketing | `pnpm --filter @apps/marketing run dev` | `http://operator.localhost:3002` |
| Portal | `pnpm --filter @apps/portal run dev` | `http://operator.portal.localhost:3003` |

Dev env (`apps/api/.env.local`):

- `AUTH_ALLOW_DEV_STATIC_OTP=true`
- `ALLOW_DEV_WEB_SESSION=true`

---

## 4. Verify

```bash
pnpm run p7:gate
pnpm run p7:staging-verify   # host smoke when API up
```

Manual checks:

| # | URL | Expect |
| - | --- | ------ |
| 1 | `http://operator.localhost:3002/tours` | North Ridge Trek listed |
| 2 | Tour detail → Register CTA | portal register URL |
| 3 | `http://operator.portal.localhost:3003` | OTP with `1234` |
| 4 | `http://operator.admin.localhost:3000/auth/login` | operator OTP login |

Host bind only (API must be running):

```bash
TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs
```

---

## 5. Relation to staging (P7-0-N-002+)

Local uses canonical `*.localhost` hosts. Staging uses `{club}.{root}` — same `tenantId` contract, different env matrix → [p7-0-env-matrix.md](p7-0-env-matrix.md).
