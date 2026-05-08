# Installation and Prerequisites

## Required tooling

- Node.js `22.x`
- `pnpm` `9.x`
- Docker + Docker Compose
- `git`, `curl`, `rg`

## Verify tooling

```bash
node -v
pnpm -v
git --version
curl --version
rg --version
docker --version
docker compose version
```

## Install dependencies

From repo root:

```bash
pnpm install --frozen-lockfile
```

## API environment bootstrap

```bash
cp apps/api/.env.example apps/api/.env
```

Fill required values from your team secrets source.

Canonical source of truth is `apps/api/src/config/env.schema.ts`.
Minimum required to start API:

- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `TELEGRAM_BOT_TOKEN`
- `INTERNAL_API_KEY`
- `PAYMENTS_WEBHOOK_SIGNING_SECRET`
- `TENANT_ROOT_DOMAIN` (set `localhost` for local subdomain testing)

Security note:

- Keep `AUTH_ALLOW_DEV_STATIC_OTP=false` by default.
- Never enable dev static OTP in staging/preprod/prod.
- Use `node --import tsx` runner for operational TS scripts.

## Infrastructure services

Start local stack:

```bash
docker compose -f infra/docker-compose.full.yml up -d
```

Stop:

```bash
docker compose -f infra/docker-compose.full.yml down
```

## Next documents

- `docs/60-operations/getting_started.md`
- `docs/60-operations/db_migration_and_seed.md`
- `docs/60-operations/test_and_quality_commands.md`
