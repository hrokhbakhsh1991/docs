# Getting Started

This guide is the fastest valid path to run the project locally with the current monorepo scripts.

## Prerequisites

- Node.js `22.x` (see root `package.json` engines)
- `pnpm` `9.x`
- Docker + Docker Compose

Quick verify:

```bash
node -v
pnpm -v
docker --version
docker compose version
```

## 1) Install dependencies

From repository root:

```bash
pnpm install --frozen-lockfile
```

## 2) Configure API environment

```bash
cp apps/api/.env.example apps/api/.env
```

Then set valid values for required keys in `apps/api/src/config/env.schema.ts`.
Minimum practical set for local boot:

- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `TELEGRAM_BOT_TOKEN`
- `INTERNAL_API_KEY`
- `PAYMENTS_WEBHOOK_SIGNING_SECRET`
- `PAYMENTS_WEBHOOK_SIGNING_SECRET_PREVIOUS` (optional; keep empty unless rotating secret)
- `TENANT_ROOT_DOMAIN` (recommended for subdomain tenant routing; use `localhost` locally)
- `CORS_ORIGIN` (optional in dev, required for explicit cross-origin policies)

Optional but important for auth safety:

- `AUTH_ALLOW_DEV_STATIC_OTP=false` (default, keep it off unless local debugging)

Runner policy:

- TS scripts run via `node --import tsx` (no `ts-node/register` split).

## 3) Start infrastructure

Local dev database/redis:

```bash
docker compose -f infra/docker-compose.full.yml up -d
```

## 4) Run database migrations

```bash
pnpm --filter @apps/api migrate:run
```

## 5) Seed data (optional but recommended)

```bash
pnpm --filter @apps/api seed
```

## 6) Start API

```bash
pnpm --filter @apps/api dev
```

## 7) Start Web app (new terminal)

```bash
pnpm --filter @apps/web dev
```

## 8) Smoke checks

API health:

```bash
curl -fsS http://localhost:3000/health
```

Web app:

- open `http://localhost:3000`
- OTP login endpoint used by UI: `POST /api/v2/auth/web/session/otp`

## Useful references

- `docs/authentication-phone-otp.md`
- `docs/multi-tenant-subdomain.md`
- `docs/tenant-rate-limiting.md`
- `docs/observability-monitoring.md`
