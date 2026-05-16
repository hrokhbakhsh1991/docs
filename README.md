# Tour Ops Monorepo

## Stack

- Node.js 22 LTS
- pnpm workspaces
- NestJS (API)
- Next.js (Web)
- React + Vite (Telegram placeholder)
- PostgreSQL 16
- Redis 7

## Repository Layout

```text
apps/
  api/
  web/
  telegram/
packages/
  config/
  types/
infra/
  docker-compose.yml          # Postgres + Redis only
  docker-compose.full.yml    # full stack (includes ↑ via Compose `include`)
  docker/
    Dockerfile.api
    Dockerfile.web
tools/
```

## Prerequisites

- Node.js 22
- pnpm 9+
- Docker + Docker Compose

## Setup

```bash
nvm use
pnpm install
```

Copy API env and keep `apps/api/src/config/env.schema.ts` as the source of truth for names/defaults:

```bash
cp apps/api/.env.example apps/api/.env
```

## Run Local Infra

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Run full stack (Docker)

Postgres/Redis plus **Nest API** and **Next.js** as container images are defined in **`infra/docker-compose.full.yml`**. That file **includes** `infra/docker-compose.yml` for databases, then adds `api` and `web` services built from **`infra/docker/Dockerfile.api`** and **`infra/docker/Dockerfile.web`**.

**Requirements:** Docker Engine + Docker Compose **v2.20+** (Compose Specification `include`).

### Local full stack

From the repository root:

```bash
pnpm docker:bootstrap   # generates infra/.env.docker (JWT keys, DB/Redis hosts — do not commit)
pnpm docker:stack       # docker compose -f infra/docker-compose.full.yml up --build -d
```

Equivalent manual invocation:

```bash
bash infra/scripts/docker-bootstrap-env.sh
docker compose -f infra/docker-compose.full.yml up --build -d
```

The Compose file expects **`infra/.env.docker`** (created by the bootstrap script). Services publish:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

The web image is built with `NEXT_PUBLIC_API_URL=http://localhost:3001` so the browser can reach the API on the host. **Production:** rebuild the web image with your public API base URL (and set **`CORS_ORIGIN`** on the API to match your frontend origins). Manage secrets via your host or orchestrator, not committed env files.

Stop (pnpm shortcut):

```bash
pnpm docker:stack:down
```

Or:

```bash
docker compose -f infra/docker-compose.full.yml down
```

### CI (Docker build verification)

On pull requests and pushes to **`main`**, `.github/workflows/docker-build.yml` runs **`docker build`** for both images (same Dockerfiles as above; images are not pushed to a registry). This catches broken Docker contexts or dependency installs early.

## Deterministic local run (from repository root)

```bash
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker-compose.full.yml up -d
pnpm --filter @apps/api migrate:run
pnpm --filter @apps/api seed
pnpm --filter @apps/api dev
pnpm --filter @apps/web dev
```

## Commands (from repository root)

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm test:security
```

### Runner strategy

- TypeScript operational/test scripts use `node --import tsx` (single runner strategy).
- API scripts in `apps/api/package.json` are aligned to `tsx` for seed, migration, and e2e execution.

### Security tests (`pnpm test:security`)

These tests validate:

- tenant isolation
- invite role hierarchy
- JWT membership enforcement
- connection pool tenant context safety

Security tests must pass before production deployment.

The script runs Jest against `tests/security`, which delegates to the API’s Testcontainers-backed `node:test` suites under `apps/api/test/e2e/` (Docker must be available).

## API Overview

API base path is `/api/v2` (Swagger server URL is aligned to this base path).

> **NOTE (current frontend approach):** In leader/review flows, FE currently composes data on the client (`getTours` + per-tour registrations + client-side CSV) as a temporary implementation until aggregation endpoints (`GET /api/v2/dashboard/leader-workspace`, `GET /api/v2/reconciliation/export.csv`) are shipped.

- Auth (see **`docs/authentication-phone-otp.md`**)
  - **`POST /api/v2/auth/web/session/otp`** — web login: JSON `{"phone":"<E.164>","otp":"<code>"}`; tenant from **`Host`** subdomain (e.g. `ws1-rbac.localhost:3000`). Static OTP `1234` is only available when `AUTH_ALLOW_DEV_STATIC_OTP=true` in `development`/`test`.
  - `POST /api/v2/auth/telegram/session`
  - `POST /api/v2/auth/link-telegram`
  - `POST /api/v2/auth/workspace/session` — exchange JWT for another workspace (authenticated)
- Tours
  - `POST /api/v2/tours`
  - `PATCH /api/v2/tours/:tourId`
  - `GET /api/v2/tours`
  - `GET /api/v2/tours/:tourId`
- Payments
  - `POST /api/v2/payments/intent`
  - `GET /api/v2/admin/payments`
  - `GET /api/v2/admin/payments/:id`
  - `POST /api/v2/admin/payments/:id/refund`
  - `POST /internal/payments/webhook` (always returns `200`, logs failures internally)

Frontend/staging base URL example:

`REACT_APP_API_BASE=https://staging.yourdo.com/api/v2`

## API Runtime Modes (Freeze Policy)

`apps/api` supports scheduler-safe deployment modes via env flags:

- `ENABLE_SCHEDULERS=true|false`
- `APP_RUNTIME_ROLE=api|worker|all`
- `JOB_SCHEDULER_JITTER_MS=<non-negative integer>`

Recommended setup:

- API pods: `APP_RUNTIME_ROLE=api` and `ENABLE_SCHEDULERS=true` (schedulers are role-gated)
- Worker pod: `APP_RUNTIME_ROLE=worker` and `ENABLE_SCHEDULERS=true`

Scheduler logs expose:

- `job_started`
- `job_finished`
- `job_skipped_due_lock`

Runtime metrics are available in `GET /internal/ops/health` under `schedulers`.

## Notes

- This repository is bootstrapped for infrastructure and project structure only.
- No business logic is implemented.
