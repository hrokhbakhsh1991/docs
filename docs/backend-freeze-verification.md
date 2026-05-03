# Backend Freeze Verification

This runbook standardizes backend verification before contract freeze.

## 1) Prepare test environment file

From repository root:

```bash
cp apps/api/.env.test.example apps/api/.env.test
```

Adjust values if your local ports or credentials differ.

## 2) Start local E2E infrastructure

```bash
pnpm e2e:infra:start
```

This starts:
- PostgreSQL (`postgres:15`) on `localhost:5432`
- Redis (`redis:7`) on `localhost:6379`

## 3) Run database migrations

```bash
pnpm e2e:migrate
```

## 4) Execute E2E tests

```bash
pnpm --dir apps/api test:e2e
```

Or use the CI-style single-worker flow:

```bash
pnpm test:e2e:ci
```

## 5) Verify Swagger generation

```bash
pnpm --dir apps/api build
```

Expected output includes successful OpenAPI generation at:
- `apps/api/openapi.json`

## 6) Verify health endpoints

Start API (optional) and check:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/health/live
curl -s http://localhost:3000/health/ready
```

## 7) Stop infrastructure

```bash
pnpm e2e:infra:stop
```

---

When migrations, E2E tests, swagger generation, and health checks all pass, backend is freeze-ready for frontend integration.
