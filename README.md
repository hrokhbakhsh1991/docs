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
  docker-compose.yml
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

## Run Local Infra

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Commands (from repository root)

```bash
pnpm dev
pnpm build
pnpm lint
```

## API Overview

API base path is `/api/v2` (Swagger server URL is aligned to this base path).

- Auth
  - `POST /api/v2/auth/web/session`
  - `POST /api/v2/auth/telegram/session`
  - `POST /api/v2/auth/link-telegram`
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
