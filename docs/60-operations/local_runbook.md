# Local Development Runbook

This runbook is aligned with current `package.json` scripts in root + `apps/api` + `apps/web`.
Environment key names/defaults are governed by `apps/api/src/config/env.schema.ts`.

## Startup order

1. Install deps
2. Start infra (postgres/redis)
3. Run migrations
4. Seed data (optional)
5. Start API
6. Start Web

## Commands

### 1) Install

```bash
pnpm install --frozen-lockfile
```

### 2) Infra up

```bash
docker compose -f infra/docker-compose.full.yml up -d
```

### 3) Migrate

```bash
pnpm --filter @apps/api migrate:run
```

### 4) Seed (optional)

```bash
pnpm --filter @apps/api seed
pnpm --filter @apps/api seed:bulk-test-users
```

### 5) Start API

```bash
pnpm --filter @apps/api dev
```

### 6) Start Web (second terminal)

```bash
pnpm --filter @apps/web dev
```

## Health checks

```bash
curl -fsS http://localhost:3000/health
```

Then open:

- `http://localhost:3000` (web)

## OTP dev behavior

- Canonical endpoint: `POST /api/v2/auth/web/session/otp`
- Static OTP dev bypass is disabled by default.
- To enable local debugging only, set `AUTH_ALLOW_DEV_STATIC_OTP=true` in `apps/api/.env` and keep `NODE_ENV=development`.
- All API TS scripts (seed/migrations/e2e) use `node --import tsx`.

## Shutdown

Stop apps with terminal Ctrl+C, then:

```bash
docker compose -f infra/docker-compose.full.yml down
```
