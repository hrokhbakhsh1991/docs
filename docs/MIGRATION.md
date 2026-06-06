# Migration — quick index

**نقشهٔ کل:** [`MIGRATION-MAP.md`](MIGRATION-MAP.md) — شامل §5 infra · §6 events · §7 tenant · §8 versioning · §10 observability

## سندهای فاز (اجرایی — جزئیات کامل)

| فاز                        | سند                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **0** Foundation & SDK     | [`phase-0-foundation.md`](phase-0-foundation.md) ✅ · AI-exec: [`phase-0/`](phase-0/README.md)                                  |
| **1** Platform core        | [`phase-1-platform-core.md`](phase-1-platform-core.md) ✅ · AI-exec: [`phase-1/`](phase-1/README.md)                            |
| **2** Design system        | [`phase-2-design-system.md`](phase-2-design-system.md) ✅ · AI-exec: [`phase-2/`](phase-2/README.md)                            |
| **3** Starter + apps       | [`phase-3-design-system.md`](phase-3-design-system.md) ✅ · AI-exec: [`phase-3/`](phase-3/README.md)                            |
| **4** Tenant kernel        | [`phase-4-tenant-kernel.md`](phase-4-tenant-kernel.md) ✅ · AI-exec: [`phase-4/`](phase-4/README.md)                            |
| **5** Canonical data layer | [`phase-5-canonical-schema.md`](phase-5-canonical-schema.md) · AI-exec: [`phase-5/`](phase-5/README.md)                         |
| **6** Denali workspace     | [`phase-6-denali-workspace.md`](phase-6-denali-workspace.md) — **active (doc pack)** · AI-exec: [`phase-6/`](phase-6/README.md) |

**Cross-phase continuity:** [`appendices/PLATFORM-CONTINUITY-0-6.md`](appendices/PLATFORM-CONTINUITY-0-6.md)

## North star

Platform logic = generic · Workspace logic = injectable · Tenant = security boundary

## فاز جاری

**Phase 6** — Denali workspace (plugin port, bootstrap, MinIO, migrateCanonical) — **doc pack active** · agents: [`phase-6/phase-6-agent-router.md`](phase-6/phase-6-agent-router.md)

**Prerequisites:** `phase-5:gate` exit 0 + [`phase-6/subphases/6.0-entry-gate.md`](phase-6/subphases/6.0-entry-gate.md)

```bash
pnpm run phase-5:gate   # required before Phase 6 work
pnpm run phase-6:guard  # doc pack (PEK v1)
pnpm run phase-6:gate   # 6.9 when implementation complete
pnpm run phase-5:guard
pnpm build && pnpm test
```

## Legacy

[`legacy/`](../legacy/) — monorepo قبلی؛ مرجع port Denali (فاز ۶).
