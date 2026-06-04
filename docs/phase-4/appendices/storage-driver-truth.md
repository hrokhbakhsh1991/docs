# Phase 4 — Storage driver truth (apps/api)

```yaml
agent_load_tier: T0_execution
owner: apps/api/src/storage/create-tour-storage.ts
corrects_doc_drift: "TOUR_STORAGE env name in older subphase drafts"
```

| Env / condition | Driver | Notes |
|-----------------|--------|-------|
| `STORAGE_DRIVER=memory` | InMemory | Unit tests, local without DB |
| `STORAGE_DRIVER=prisma` | Prisma | Requires `DATABASE_URL` |
| *(unset)* + `NODE_ENV=production` | prisma | Fail if no DATABASE_URL |
| *(unset)* + non-production | memory | **Not** Postgres SoT — 4.2 must set explicit prisma for dev SoT |

**Phase 4.2 exit (P4-E-DATA-01):** document and CI prove tours survive restart with `STORAGE_DRIVER=prisma` + migrations applied.

**Phase 5:** renames `canonical` → `canonical_data` — see [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md).
