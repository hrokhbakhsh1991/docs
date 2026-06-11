# Settings port scope — Phase 9.6 persistence (007)

```yaml
scope_version: "2026-06-09-v1"
decision: [DEC-P9-010, DEC-P9-005]
registry: SETTINGS-MODULE-REGISTRY.md
prisma_schema: apps/api/prisma/schema.prisma
migration_target: infra/sql/007_operator_settings_delta.sql
prisma_migration: apps/api/prisma/migrations/20260609120000_operator_settings_delta
settings_driver: "follows STORAGE_DRIVER memory|prisma — see create-settings-*-repository.ts"
```

## Intent

Close **Phase 1C foundation** so operator settings (reference catalogs + versioned tenant config + audit explorer) persist under Postgres RLS when `STORAGE_DRIVER=prisma`. In-memory stores remain the default for unit specs and smoke servers.

**Binding:** All tenant-scoped rows use `withTenantRls(tenantId, …)` — same pattern as identity memberships and operator registrations.

---

## Prisma models (Phase 9.6 · migration 007)

| Model | Table | Purpose |
| ----- | ----- | ------- |
| `TenantConfig` | `tenant_config` | Versioned JSON (`wizard_template`, `presets_advanced`) |
| `WorkspaceEquipment` | `workspace_equipment` | Equipment reference catalog |
| `WorkspaceTourTheme` | `workspace_tour_themes` | Tour themes (`tenant_id` + unique `slug`) |
| `WorkspaceGuideLanguage` | `workspace_guide_languages` | Guide languages catalog |
| `WorkspaceTourPreset` | `workspace_tour_presets` | Tour presets · optional FK → theme |
| `WorkspaceRegion` | `workspace_regions` | Location regions |
| `WorkspaceDestination` | `workspace_destinations` | Destinations · FK → region |
| `OperatorSettingsAuditEvent` | `operator_settings_audit_events` | Read-only audit explorer (R-P9-S13) |

### SQL delta (`007_operator_settings_delta.sql`)

| Table | RLS | Notes |
| ----- | --- | ----- |
| `tenant_config` | Yes | PK `(tenant_id, config_key)` · `payload jsonb` |
| `workspace_*` (6 tables) | Yes | Normalized per DEC-P9-010 · no JSON blob catalog |
| `operator_settings_audit_events` | Yes | Append-only explorer feed · not `audit_events` |

**Repository wiring:**

| Port | Factory | Prisma impl |
| ---- | ------- | ----------- |
| Config | `create-settings-config-repository.ts` | `PrismaSettingsConfigRepository` |
| Resources | `create-settings-resources-repository.ts` | `PrismaSettingsResourcesRepository` |
| Audit | `create-settings-audit-repository.ts` | `PrismaSettingsAuditRepository` |

All three interfaces are **async** — services and route handlers `await` repository calls.

### Forbidden

| Pattern | Reason |
| ------- | ------ |
| Single `tenant_reference_items` JSON table | DEC-P9-010 · loses FK integrity |
| Unversioned wizard template blob | R-P9-S02 · migrate-on-read in service layer |
| Sync Prisma calls in HTTP handlers | Identity/bookings precedent — async repos only |

---

## Verification

| Proof | Command |
| ----- | ------- |
| Memory specs (unchanged driver) | `settings-*.spec.ts` with `STORAGE_DRIVER=memory` |
| Postgres integration | `phase-9-persistence.integration.spec.ts` when `DATABASE_URL` set |
| Migrate deploy | `DATABASE_URL_ADMIN=… pnpm --filter @apps/api run db:migrate:deploy` |
