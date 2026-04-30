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

## Notes

- This repository is bootstrapped for infrastructure and project structure only.
- No business logic is implemented.
