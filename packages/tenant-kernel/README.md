# @app-tour/tenant-kernel

Host-based tenant label parsing and PostgreSQL RLS session helpers for app-tour Phase 4.

## Central documentation

| Doc | Link |
|-----|------|
| **Phase 4 guide** | [`docs/phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md) · [Markdoc](../../docs/phase-4-tenant-kernel.mdoc) |
| Migration map | [`docs/MIGRATION-MAP.md`](../../docs/MIGRATION-MAP.md) |

## Scope

- Pure TypeScript — no Nest, no Prisma in this package
- `apps/api` / `apps/web` adapters consume this surface

## Commands

```bash
pnpm --filter @app-tour/tenant-kernel run build
pnpm --filter @app-tour/tenant-kernel test
pnpm --filter @app-tour/tenant-kernel run test:phase-4
```
