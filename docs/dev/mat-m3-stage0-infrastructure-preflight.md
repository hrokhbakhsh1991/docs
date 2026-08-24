# MAT-M3 Stage 0 — infrastructure pre-flight map

**Date:** 2026-08-24  
**Verdict:** **AUTHORIZED TO IMPLEMENT** — no hard blockers; resolver layer required before regionalization

---

## Current deployment architecture (observed)

| Layer | Current owner | Notes |
|-------|---------------|-------|
| API runtime | Shared process (`apps/api`) | Single deploy artifact; host-based tenant routing |
| Web / Portal / Marketing | Separate Next.js surfaces | Shared artifact per surface |
| Postgres | `DATABASE_URL` pool + optional `tenant_routes` silo | `TenantConnectionRouter` (pool/silo) |
| Redis | Global `REDIS_URL` (optional) | Rate limiter store; memory fallback in dev |
| Object storage | Tenant branding paths in shared storage driver | `tenant-branding-storage.ts` |
| Queue / outbox | Prisma `outbox_events` on tenant RLS connection | In-memory driver in dev |
| Secrets | Process env (`DATABASE_URL`, `REDIS_URL`, JWT keys) | No per-workspace secret store in-app |
| Domain routing | Host → tenant/workspace (`tenant-kernel` host parse) | WRS / PCMS certified |
| Workspace registry | Codegen + `manifest-fingerprint` (REM-007) | Process-level reload on drift |

---

## Global singleton assumptions

| Assumption | Blocks per-workspace placement? | Mitigation |
|------------|----------------------------------|------------|
| Single `getPrisma()` client | **Partial** — silo URL exists but client is pool-scoped today | Placement resolver returns target URL; existing `tenant_routes` silo path reused for `DEDICATED_DB` |
| Global `REDIS_URL` | **Partial** — namespace isolation sufficient for MVP | Stamp-scoped cache namespace in resolver output |
| Global storage driver | **Partial** | Stamp-scoped storage namespace |
| Shared outbox table | **Partial** | Queue namespace per stamp; physical isolation only in `DEDICATED_STAMP` |
| Env-based secrets | **Yes for full stamp isolation** | Secrets reference by stamp id — credentials remain **EXTERNAL_ONLY** |

No change to Tour Core / Finance / Booking domain code required for MAT-010 resolver introduction.

---

## Dependency classification

| Dependency | Classification | MAT-010 action |
|------------|----------------|----------------|
| Postgres pool URL | **PLACEMENT_READY** | Map `SHARED` → pool; `DEDICATED_DB` → explicit target |
| `tenant_routes` silo rows | **PLACEMENT_READY** | Bridge from placement resolver |
| Host / tenant routing | **PLACEMENT_READY** | Unchanged |
| Workspace manifest fingerprint | **PLACEMENT_READY** | Include in bundle fingerprint |
| Version pins (MAT-001) | **PLACEMENT_READY** | Include in bundle fingerprint |
| Redis rate limiter | **NEEDS_RESOLVER** | Stamp-scoped namespace in resolver output |
| Object storage paths | **NEEDS_RESOLVER** | Stamp-scoped namespace |
| Outbox / projection queue | **NEEDS_RESOLVER** | Stamp-scoped namespace |
| Provider credentials | **EXTERNAL_ONLY** | Document; not in fingerprint payload |
| Live multi-region Postgres | **EXTERNAL_ONLY** | `REGIONAL_STAMP` schema + policy; provider proof blocked |
| Alertmanager / Grafana | **EXTERNAL_ONLY** | MAT-012 already marked BLOCKED_EXTERNAL |

---

## Placement readiness verdict

MAT-010 can ship a **neutral infrastructure resolver** + **deterministic bundle fingerprint** without business-architecture changes.

MAT-013 extends the same resolver with `region` + `residencyPolicy` enforcement — **blocked until MAT-010 resolver exists** (satisfied in this run).

*Architect, documentation status: Updated. Link to docs: `docs/dev/mat-m3-stage0-infrastructure-preflight.md`.*
