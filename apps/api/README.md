# @apps/api

**Phase 3.2+** thin HTTP API — CASL-scoped tours; **Phase 4** tenant-config + events; **Phase 5** canonical_data + outbox ([`phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md) · [`phase-5-canonical-schema.md`](../../docs/phase-5-canonical-schema.md)).

## Central documentation

| Doc                | Link                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 4 guide**  | [`docs/phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md) · [Markdoc](../../docs/phase-4-tenant-kernel.mdoc)                                                                                                        |
| **Phase 5 schema** | [`docs/phase-5-canonical-schema.md`](../../docs/phase-5-canonical-schema.md) · [Markdoc](../../docs/phase-5-canonical-schema.mdoc) · router [`docs/phase-5/phase-5-agent-router.md`](../../docs/phase-5/phase-5-agent-router.md) |
| **Phase 3 guide**  | [`docs/phase-3-design-system.md`](../../docs/phase-3-design-system.md) · [Markdoc](../../docs/phase-3-design-system.mdoc) (§10 API boundary)                                                                                     |
| Forensic audit     | [`docs/audits/phase-3-zero-debt-forensic-audit.md`](../../docs/audits/phase-3-zero-debt-forensic-audit.md)                                                                                                                       |
| Integrity report   | [`docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc`](../../docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc)                                                                                               |
| Migration map      | [`docs/MIGRATION-MAP.md`](../../docs/MIGRATION-MAP.md)                                                                                                                                                                           |

## Commands

```bash
pnpm --filter @apps/api run build
pnpm --filter @apps/api test
pnpm --filter @apps/api run guard:tenant-isolation
pnpm --filter @apps/api run phase-3:api-gate
```

**Tenant headers:** `x-authenticated-tenant-id` required on tour routes; optional `x-tenant-id` must match when both are sent.

## Workspace plugin resolution (Phase 4 / MAP 5.2)

`POST /tours` validates canonical payloads through the **workspace plugin** before any storage write:

1. `resolveWorkspaceTypeForTenant` — [`src/tenant/resolve-workspace-type.ts`](src/tenant/resolve-workspace-type.ts)
2. `resolveWorkspacePluginForType` — [`src/workspace/resolve-workspace-plugin.ts`](src/workspace/resolve-workspace-plugin.ts) (starter-only until Phase 6)
3. `buildValidatedCanonicalDocument` — platform-core + plugin hooks ([`src/tours/canonical-validation.ts`](src/tours/canonical-validation.ts))
4. `CanonicalTourService.writeTour` — CASL-scoped persist (memory or Prisma via `STORAGE_DRIVER`)

Tests: `test/canonical-validate-before-persist.spec.ts`, `test/validate-before-persist-ordering.spec.ts`, `src/workspace/resolve-workspace-plugin.spec.ts`.

**Postgres RLS:** `infra/sql/001_tenant_rls.sql` + `src/db/with-tenant-rls.ts` (transaction-scoped `set_config`) used by `PrismaTourRepository`. Dev DB: `docs/phase-4/dev/docker-compose.yml` — use `app_tour` role (not `postgres` superuser) for integration tests; see `docs/phase-4/ci.md`.
