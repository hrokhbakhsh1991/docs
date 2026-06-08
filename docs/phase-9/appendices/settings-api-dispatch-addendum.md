# Phase 9.6 — Settings modules API dispatch addendum

```yaml
addendum_id: DISPATCH-P9-SETTINGS
version: "2026-06-08-v2"
authority: SETTINGS-MODULE-REGISTRY.md · DEC-P9-009 · DEC-P9-010 · DEC-P9-005
target: apps/api/src/openapi/dispatch-routes.ts
supersedes: "2026-06-08-v1 flat template routes only"
```

## Dispatch operations (9.6)

### Manifest introspection

| operationId           | Method | Path                | Handler                            | CASL                     |
| --------------------- | ------ | ------------------- | ---------------------------------- | ------------------------ |
| `listSettingsModules` | GET    | `/settings/modules` | `settings/modules.list.handler.ts` | `requireOperatorSession` |

Returns manifest metadata filtered by actor abilities — no Zod schemas inlined (ids, routes, nav groups only).

### Reference data router (DEC-P9-010)

| operationId               | Method | Path                                      | Handler                                 | CASL                             |
| ------------------------- | ------ | ----------------------------------------- | --------------------------------------- | -------------------------------- |
| `listSettingsResource`    | GET    | `/settings/resources/{moduleId}`          | `settings/resources.list.handler.ts`    | module `ability` read            |
| `createSettingsResource`  | POST   | `/settings/resources/{moduleId}`          | `settings/resources.create.handler.ts`  | `isAdminOrOwner` + ability       |
| `patchSettingsResource`   | PATCH  | `/settings/resources/{moduleId}/{itemId}` | `settings/resources.patch.handler.ts`   | same                             |
| `deleteSettingsResource`  | DELETE | `/settings/resources/{moduleId}/{itemId}` | `settings/resources.delete.handler.ts`  | same                             |
| `reorderSettingsResource` | POST   | `/settings/resources/{moduleId}/reorder`  | `settings/resources.reorder.handler.ts` | when manifest `features.reorder` |

**Unknown moduleId:** **404** `SETTINGS_MODULE_UNKNOWN` — no DB query (R-P9-S07).

### Tenant config router (versioned JSONB)

| operationId         | Method | Path                           | Handler                          | CASL                   |
| ------------------- | ------ | ------------------------------ | -------------------------------- | ---------------------- |
| `getSettingsConfig` | GET    | `/settings/config/{configKey}` | `settings/config.get.handler.ts` | module ability         |
| `putSettingsConfig` | PUT    | `/settings/config/{configKey}` | `settings/config.put.handler.ts` | `isAdminOrOwner` + Zod |

### Legacy alias routes (compatibility — thin wrappers)

| operationId             | Method | Path                             | Maps to                                |
| ----------------------- | ------ | -------------------------------- | -------------------------------------- |
| `getTourWizardTemplate` | GET    | `/settings/tour-wizard-template` | `GET /settings/config/wizard_template` |
| `putTourWizardTemplate` | PUT    | `/settings/tour-wizard-template` | `PUT /settings/config/wizard_template` |

## Cache invalidation (DEC-P9-005)

On successful `putSettingsConfig` (including wizard template alias):

1. Validate payload with module Zod schema + `config_version`.
2. Persist `tenant_config` row.
3. `invalidateTenantConfig(tenantId, configKey)`.
4. Emit audit event.
5. Return **200** — wizard must read fresh effective config (SMK-P9-05).

## Urban regression

Routes under `/urban/settings` remain owner-only — **not** replaced by this addendum. Denali `/settings/*` **hidden** on urban host at web shell (manifest filter).

## Literal insertion block

```typescript
export const SETTINGS_OPERATOR_DISPATCH = [
  {
    operationId: "listSettingsModules",
    method: "GET",
    path: "/settings/modules",
    handler: "settings/modules.list.handler",
  },
  {
    operationId: "listSettingsResource",
    method: "GET",
    path: "/settings/resources/{moduleId}",
    handler: "settings/resources.list.handler",
  },
  {
    operationId: "putSettingsConfig",
    method: "PUT",
    path: "/settings/config/{configKey}",
    handler: "settings/config.put.handler",
  },
] as const;
```
