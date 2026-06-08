# URBAN-THEME-MERGE-ALGORITHM

```yaml
contract_id: "URBAN-THEME-MERGE-ALGORITHM"
version: "2026-06-07-v1"
authority: docs/phase-8/appendices/schemas/URBAN-THEME-JSONB.schema.json
target_service: apps/api/src/urban/urban-settings.service.ts
target_function: patchThemeUrban
prisma_model: Tenant
prisma_field: theme
```

## INPUTS

| Symbol          | Type                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| `tenantId`      | `string` UUID                                                             |
| `auth.tenantId` | `string` — MUST equal `tenantId`                                          |
| `existingTheme` | `Json \| null` — current `Tenant.theme` row                               |
| `patchBody`     | `UrbanSettingsPatchBody` — validated `parseUrbanSettingsPatchBody` output |

## DEFAULTS

```text
DEFAULT_URBAN_CATALOG := { publicEnabled: true, slug: "catalog" }
DEFAULT_URBAN_REGISTRATION := { policy: "open", requirePhone: false }
DEFAULT_URBAN := { catalog: DEFAULT_URBAN_CATALOG, registration: DEFAULT_URBAN_REGISTRATION }
```

## HELPERS

```text
FUNCTION isPlainObject(value):
  RETURN value !== null AND typeof value === "object" AND NOT Array.isArray(value)

FUNCTION cloneJson(value):
  RETURN JSON.parse(JSON.stringify(value))

FUNCTION mergeUrbanSubtree(existingUrban, patchUrban):
  base := isPlainObject(existingUrban) ? cloneJson(existingUrban) : cloneJson(DEFAULT_URBAN)

  IF patchUrban.catalog IS DEFINED:
    catalogBase := isPlainObject(base.catalog) ? base.catalog : cloneJson(DEFAULT_URBAN_CATALOG)
    IF patchUrban.catalog.publicEnabled IS DEFINED:
      catalogBase.publicEnabled := patchUrban.catalog.publicEnabled
    IF patchUrban.catalog.slug IS DEFINED:
      catalogBase.slug := patchUrban.catalog.slug
    base.catalog := catalogBase

  IF patchUrban.registration IS DEFINED:
    regBase := isPlainObject(base.registration) ? base.registration : cloneJson(DEFAULT_URBAN_REGISTRATION)
    IF patchUrban.registration.policy IS DEFINED:
      regBase.policy := patchUrban.registration.policy
    IF "requirePhone" IN keys(patchUrban.registration):
      regBase.requirePhone := patchUrban.registration.requirePhone
    ELSE:
      IF NOT ("requirePhone" IN keys(regBase)):
        regBase.requirePhone := DEFAULT_URBAN_REGISTRATION.requirePhone
    IF "confirmationMessage" IN keys(patchUrban.registration):
      regBase.confirmationMessage := patchUrban.registration.confirmationMessage
    ELSE:
      DELETE regBase.confirmationMessage WHEN NOT ("confirmationMessage" IN keys(regBase))
    base.registration := regBase

  RETURN base
```

## OMITTED VS PRESENT KEYS (Zod output)

| Patch path                               | Key absent in `patchBody` after Zod     | Merge behavior                                                                                  |
| ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `urban.catalog.publicEnabled`            | impossible — Zod required               | overwrite `base.catalog.publicEnabled`                                                          |
| `urban.catalog.slug`                     | impossible — Zod required               | overwrite `base.catalog.slug`                                                                   |
| `urban.registration.policy`              | impossible — Zod required               | overwrite `base.registration.policy`                                                            |
| `urban.registration.requirePhone`        | optional omitted                        | preserve `existingUrban.registration.requirePhone` or `DEFAULT_URBAN_REGISTRATION.requirePhone` |
| `urban.registration.requirePhone`        | present `boolean`                       | overwrite                                                                                       |
| `urban.registration.confirmationMessage` | optional omitted                        | preserve existing `confirmationMessage` if present; else omit key                               |
| `urban.registration.confirmationMessage` | present `string`                        | overwrite                                                                                       |
| `undefined` in TS runtime                | never emitted by Zod for validated body | no-op                                                                                           |

## `patchThemeUrban(existingTheme, patchBody)`

```text
FUNCTION patchThemeUrban(existingTheme, patchBody) -> TenantThemeJsonb:

  mergedTheme := isPlainObject(existingTheme) ? cloneJson(existingTheme) : {}

  mergedTheme.urban := mergeUrbanSubtree(
    isPlainObject(existingTheme) ? existingTheme.urban : null,
    patchBody.urban,
  )

  FORBIDDEN mutate mergedTheme.primaryColor from patchBody
  FORBIDDEN mutate mergedTheme.featureFlags from patchBody
  FORBIDDEN mutate mergedTheme.rateLimitRps from patchBody

  RETURN mergedTheme
```

## SIBLING PRESERVATION (Phase 5 keys)

```text
mergedTheme := clone(existingTheme) with ONLY .urban replaced
primaryColor   := existingTheme.primaryColor   — unchanged
featureFlags   := existingTheme.featureFlags   — unchanged
rateLimitRps   := existingTheme.rateLimitRps   — unchanged
```

## PRISMA UPDATE TEMPLATE

```typescript
const mergedTheme = patchThemeUrban(existingRow.theme, patchBody);

const updated = await prisma.tenant.update({
  where: { id: auth.tenantId },
  data: {
    theme: mergedTheme,
  },
  select: {
    id: true,
    theme: true,
  },
});

invalidateTenantRegistryCache(updated.id, tenantSubdomain);
invalidateTenantConfigResponseCache(updated.id);

return { theme: updated.theme };
```

| Step | Module                                                | Function                              |
| ---- | ----------------------------------------------------- | ------------------------------------- |
| 1    | `apps/api/src/urban/urban-settings.service.ts`        | `patchThemeUrban` merge               |
| 2    | `apps/api/src/prisma/client.ts`                       | `prisma.tenant.update`                |
| 3    | `apps/api/src/tenant/tenant-registry-cache.ts`        | `invalidateTenantRegistryCache`       |
| 4    | `apps/api/src/tenant/tenant-config-response-cache.ts` | `invalidateTenantConfigResponseCache` |

## HTTP RESPONSE

Authority: **DEC-P8-003** · GET contract: [`schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml)

### GET `/urban/settings` (owner read — envelope)

```text
GET /urban/settings 200 body := success/data/metadata envelope per URBAN-SETTINGS-HTTP-ENVELOPE.yaml
ASSERT response.success === true
ASSERT deepEqual(response.data.urban, tenants.theme.urban)
ASSERT response.metadata.primaryColor === tenants.theme.primaryColor ?? null
ASSERT response.metadata.featureFlags deepEquals tenants.theme.featureFlags ?? null
ASSERT response.metadata.rateLimitRps === tenants.theme.rateLimitRps ?? null
FORBIDDEN bare { urban: theme.urban } on GET 200
```

### PATCH `/urban/settings` (owner write — read-your-writes)

```text
PATCH /urban/settings 200 body := { urban: updated.theme.urban }
ASSERT deepEqual(response.urban, updated.theme.urban)
ASSERT GET /api/v2/tenant-config after invalidation reflects mergedTheme.urban within same request correlation window
```

## FORBIDDEN

```text
FORBIDDEN prisma.tenant.update({ data: { theme: patchBody } })
FORBIDDEN prisma.tenant.update({ data: { theme: { urban: patchBody.urban } } })
FORBIDDEN skip invalidateTenantRegistryCache after successful update
FORBIDDEN return patchBody.urban without re-read or merge result from updated row
```
