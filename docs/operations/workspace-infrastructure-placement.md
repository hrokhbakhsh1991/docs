# Workspace infrastructure placement (MAT-010 / MAT-013)

**Program:** Enterprise Maturity MAT-M3  
**Status:** IMPLEMENTED — placement resolver + regional policy primitives  
**Date:** 2026-08-24

---

## Architecture rule (non-negotiable)

Business architecture remains:

`workspace = profile + capabilities + workspacePolicy + branding/config + thin adapters`

Infrastructure placement is a **separate operational layer**. Tour Core, Finance, Booking, and future capabilities remain **placement-blind**.

Placement modes:

| Mode | Meaning |
|------|---------|
| `SHARED` | Shared pool DB + shared stamp namespaces |
| `DEDICATED_DB` | Dedicated Postgres target; runtime may remain shared |
| `DEDICATED_STAMP` | Isolated stamp for DB/cache/storage/queue/secrets/monitoring identity |
| `REGIONAL_STAMP` | Dedicated stamp with enforced home region + residency policy |

---

## Source of truth

| Artifact | Path | Notes |
|----------|------|-------|
| Control-plane registry | `infra/workspace-infrastructure-registry.defaults.json` | No secrets — env key references only |
| Resolver (pure) | `packages/tenant-kernel/src/resolve-workspace-infrastructure.ts` | Domain-neutral |
| Request context | `apps/api/src/infrastructure/workspace-infrastructure-request-context.ts` | Infra adapter only |
| Bundle fingerprint | `packages/tenant-kernel/src/workspace-bundle-fingerprint.ts` | Deterministic SHA-256 |

Override registry path: `WORKSPACE_INFRASTRUCTURE_REGISTRY_PATH`

---

## Bundle fingerprint payload

Deterministic fingerprint includes:

- manifest fingerprint (REM-007)
- profile/capability pins (MAT-001)
- workspacePolicy binding id
- branding config hash
- placement mode/region/stamp/database target ids
- release SHA

**Excluded:** secrets, raw database URLs, provider credentials.

---

## Provisioning

1. Choose placement mode per workspace binding (`tenantId:workspaceType`).
2. For `DEDICATED_DB`, create `databaseTargets` entry + env var (e.g. `DEDICATED_DB_DENALI_URL`).
3. For `DEDICATED_STAMP` / `REGIONAL_STAMP`, create `deploymentStamps` entry with region-scoped namespaces.
4. Optional `tenantOverrides` for explicit per-tenant placement — no implicit Denali=dedicated rule.
5. Deploy **same immutable application artifact** with stamp-specific config/env.

---

## Migration procedures (manual / controlled)

### SHARED → DEDICATED_DB

1. Provision dedicated Postgres + backup target in approved region.
2. Add `databaseTargets` + tenant override with `databaseTargetId`.
3. Run schema migration against dedicated target.
4. Freeze writes (maintenance window).
5. Copy tenant data from pool to dedicated DB under RLS-preserving procedure.
6. Switch tenant override to `DEDICATED_DB`.
7. Verify resolver output + booking/tour smoke for tenant.
8. Record bundle fingerprint before/after.

### DEDICATED_DB → DEDICATED_STAMP

1. Provision full stamp resources (DB/cache/storage/queue/secrets/monitoring).
2. Add `deploymentStamps` row with `databaseTargetId` if DB remains dedicated.
3. Migrate data + config to stamp namespaces.
4. Update tenant override to `DEDICATED_STAMP` with `stampId`.
5. Rollout stamp deploy; verify isolated restart does not affect shared stamp tenants.

### REGIONAL_STAMP

Same as dedicated stamp plus:

- Set `region` + `residencyPolicy` (`HOME_REGION_ONLY`, `APPROVED_REGIONS`, `NO_CROSS_REGION_REPLICATION`)
- Validate all resource endpoints + backup destination satisfy policy before serving traffic.

**Automatic live tenant migration is NOT implemented** — use controlled maintenance procedure above.

---

## Backup / restore

| Placement | Backup target | Restore constraint |
|-----------|---------------|-------------------|
| SHARED | Platform pool backup | Tenant RLS scope preserved |
| DEDICATED_DB | Dedicated target backup in placement region | Restore to same `databaseTargetId` |
| DEDICATED_STAMP | Stamp backup region from registry | Restore must stay in stamp region |
| REGIONAL_STAMP | Must satisfy `residencyPolicy` | Cross-region restore blocked by resolver preflight |

Provider-level backup drills: **BLOCKED_EXTERNAL**

---

## Deploy / rollback

- Deploy uses common release SHA across stamps.
- Rollback = redeploy prior release SHA to same stamp id (per deprecation policy MAT-014).
- Bundle fingerprint must change when pins/placement/release SHA change.
- Invalid/missing placement fails closed before request handling (`WORKSPACE_INFRASTRUCTURE_*` errors).

---

## Emergency fallback rules

1. **No silent fallback** from `DEDICATED_DB` or stamp modes to shared pool.
2. Missing placement registry entry → fail closed.
3. Region/residency violation → fail closed.
4. Emergency read-only shared fallback requires Architect approval + explicit temporary override documented out-of-band (not automated).

---

## External verification gaps

| Item | Status |
|------|--------|
| Real dedicated stamp deploy rehearsal | **BLOCKED_EXTERNAL** |
| Regional provider resource provisioning | **BLOCKED_EXTERNAL** |
| Cross-region migration drill | **BLOCKED_EXTERNAL** |
| Live backup/restore provider proof | **BLOCKED_EXTERNAL** |

*Architect, documentation status: Updated. Link to docs: `docs/operations/workspace-infrastructure-placement.md`.*
