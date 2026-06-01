# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

### Product overview

**Tour Ops** is a multi-tenant SaaS monorepo for tour operators. Local dev runs **PostgreSQL + Redis + MinIO** (Docker), a **NestJS API** on port **3001**, and a **Next.js web** app on port **3000**. Tenant routing uses subdomains like `denali.localhost:3000`.

### Node.js version

Root `package.json` requires **Node.js 24** (`engines.node`: `>=24.0.0 <25`). Use `nvm use 24` (or install via `nvm install 24`) before `pnpm` commands. `.nvmrc` still says `22` but CI/backend workflows also use 22 — prefer **24** locally to satisfy the root engine check.

### First-time env files (not committed)

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Generate RS256 JWT keys for `apps/api/.env` (see `infra/scripts/docker-bootstrap-env.sh` for a reference). Set at minimum:

- `PORT=3001` on the API (web expects API on 3001 via `NEXT_PUBLIC_API_PORT`)
- `TENANT_ROOT_DOMAIN=localhost` on the API (required for Host-based tenant resolution)
- `AUTH_ALLOW_DEV_STATIC_OTP=true` (dev OTP `1234`)
- `CORS_ALLOW_TENANT_SUBORIGINS=true` on the API when using `*.localhost` UI hosts
- `INTERNAL_API_KEY` matching between `apps/api/.env` and `apps/web/.env.local`

### Infrastructure (Docker)

From repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Services: Postgres **5433→5432**, Redis **6379**, MinIO **9002** (API) / **9001** (console). Cloud Agent VMs need Docker installed separately (not in the update script).

After infra is healthy:

```bash
pnpm --filter @apps/api migrate:run
pnpm --filter @apps/api seed
pnpm --filter @apps/api provision:denali   # optional but needed for denali.localhost wizard demo
```

Build workspace packages before starting the API (seed and `pnpm --filter @apps/api dev` expect compiled `dist/` outputs):

```bash
pnpm --filter @repo/types run build
pnpm --filter @repo/config run build
pnpm --filter @repo/domain-contracts run build
pnpm --filter @repo/shared run build
pnpm --filter @repo/draft-engine run build
# @repo/shared-contracts: default `tsc` may fail on `@repo/types/denali` with moduleResolution `Node`; use:
pnpm --filter @repo/shared-contracts exec tsc -p tsconfig.json --module Node16 --moduleResolution node16
pnpm --filter @repo/denali-domain run build
pnpm --filter @repo/tenant-host run build
pnpm --filter @repo/security/egress-url run build
pnpm --filter @repo/testing-infra run build   # needed for API lint/tests
pnpm --filter @repo/core run build            # needed for web lint
pnpm --filter @apps/api run build
```

### Running dev servers

**API** — `pnpm --filter @apps/api dev` runs a full rebuild chain; if `@repo/shared-contracts` build fails, use the prebuilt dist instead:

```bash
cd apps/api && NODE_ENV=development node --env-file=.env dist/main.js
```

**Web**:

```bash
pnpm --filter @apps/web dev
```

Health check: `GET http://127.0.0.1:3001/internal/ops/health`

### Hello-world verification

1. Open `http://denali.localhost:3000/auth/login`
2. Login: phone `+989121000001`, OTP `1234`
3. Visit `http://denali.localhost:3000/tours/new` (Denali tour wizard)

Or via API:

```bash
curl -X POST http://127.0.0.1:3001/api/v2/auth/web/session/otp \
  -H 'Content-Type: application/json' -H 'Host: denali.localhost' \
  -d '{"phone":"+989121000001","otp":"1234"}'
```

### Lint / test commands

See root `package.json`. Typical checks:

| Command | Notes |
|---------|--------|
| `pnpm lint` | `tsc --noEmit` for `@apps/*`; build `@repo/testing-infra` and `@repo/core` first for clean API/web lint |
| `pnpm test` | draft-engine + shared + API unit tests (861+ pass; some integration tests skip without Testcontainers DB) |
| `pnpm test:e2e:isolation` | Needs Postgres + Redis + Docker Testcontainers |
| `pnpm qa:tour-wizard-smoke` | Playwright smoke (standalone web build, no live API) |

### Pre-commit hooks

Husky runs `pnpm run ci:integrity` (full integrity gate). Hooks cannot be bypassed (`HUSKY=0` / `SKIP_HOOKS` are rejected).

### Full Docker stack alternative

```bash
pnpm docker:bootstrap
pnpm docker:stack
```

Publishes web `:3000` and API `:3001` without local Node dev servers. See `README.md`.
