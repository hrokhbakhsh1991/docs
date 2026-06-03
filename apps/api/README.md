# @apps/api

**Phase 3.2** thin HTTP API — canonical in-memory SoT, CASL-scoped tours, no Prisma in handlers.

## Central documentation

| Doc | Link |
|-----|------|
| **Phase 3 guide** | [`docs/phase-3-design-system.md`](../../docs/phase-3-design-system.md) · [Markdoc](../../docs/phase-3-design-system.mdoc) (§10 API boundary) |
| Forensic audit | [`docs/audits/phase-3-zero-debt-forensic-audit.md`](../../docs/audits/phase-3-zero-debt-forensic-audit.md) |
| Integrity report | [`docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc`](../../docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc) |
| Migration map | [`docs/MIGRATION-MAP.md`](../../docs/MIGRATION-MAP.md) |

## Commands

```bash
pnpm --filter @apps/api run build
pnpm --filter @apps/api test
pnpm --filter @apps/api run phase-3:api-gate
```

**Tenant headers:** `x-authenticated-tenant-id` required on tour routes; optional `x-tenant-id` must match when both are sent.
