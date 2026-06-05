# Phase 7 — Verification commands (canonical list)

> **Binding:** [`req-p7-command-atlas.md`](req-p7-command-atlas.md) · **REQ matrix:** [`../audits/verification-matrix.md`](../audits/verification-matrix.md)

## Entry + gates

```bash
pnpm run phase-6:gate
pnpm run phase-7:guard
pnpm run phase-7:gate
pnpm run ci:integrity
```

## Genericity (7.2)

```bash
git diff "${PHASE7_BASELINE_SHA:-main}" -- packages/platform-core
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/phase-7.contract.spec.ts
rg 'URBAN|urban' packages/platform-core --glob '!*.md'
```

## Bootstrap (7.3)

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-workspace-binding.contract.spec.ts
pnpm --filter @apps/web build
```

## E2E (7.4)

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-create-publish.integration.spec.ts
```

## Observability (7.5)

```bash
# TARGET until 7.5 impl — script path reserved
node scripts/guards/audit-log-fields.mjs --phase 7
```

## Rate limits (7.6)

```bash
REDIS_URL="${REDIS_URL:-redis://localhost:6379}" \
  pnpm --filter @apps/api exec node --import tsx --test test/rate-limit-tenant.spec.ts
```

## Tenant router (7.7)

```bash
pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts
```
