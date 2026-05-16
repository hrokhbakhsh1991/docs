# P3 performance tooling

| ID | Item | Command |
|----|------|---------|
| 4.3 | Lighter workspace probe | API `GET /api/v2/auth/workspace-host` (204); web `lookup-workspace-tenant.ts` |
| 4.5 | Heap profiling | `node scripts/run-middleware-heap-profile.mjs` |
| 7.5 | Multi-tenant load | `node scripts/load-multi-tenant-probe.mjs` |

API tenant resolution also uses Redis (`TenantHostResolverService`). Web keeps per-process `WORKSPACE_LOOKUP_CACHE_TTL_MS` for middleware isolates.
