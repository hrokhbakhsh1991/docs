# Test and Quality Commands

This document lists the commands that exist today and are runnable as-is.
Runner policy for TS test scripts: `node --import tsx`.

## Monorepo root

```bash
pnpm lint
pnpm test
pnpm test:security
```

## API app (`@apps/api`)

```bash
pnpm --filter @apps/api lint
pnpm --filter @apps/api test
pnpm --filter @apps/api test:e2e
pnpm --filter @apps/api migrate:run
```

## Web app (`@apps/web`)

```bash
pnpm --filter @apps/web lint
pnpm --filter @apps/web test:vrt
```

## E2E infrastructure helpers

```bash
pnpm e2e:infra:start
pnpm e2e:migrate
pnpm test:e2e:ci
pnpm e2e:infra:stop
```

## Recommended local order before PR

1. `pnpm lint`
2. `pnpm --filter @apps/api test`
3. `pnpm --filter @apps/web lint`
4. targeted e2e suites relevant to changed modules

## Notes

- Some e2e suites depend on local Docker/Testcontainers readiness.
- If an e2e fails with tenant binding setup errors, verify DB/redis/env bootstrap first.
