# Phase 8.1 — Urban API dispatch addendum

```yaml
addendum_version: "2026-06-07-v1"
subphase: "8.1"
authority: openapi-dispatch-contract.md (DEC-099) · CASL-URBAN-OWNER-SPEC.md · URBAN-ROUTE-MATRIX.md §C
inventory_sot: apps/api/src/openapi/dispatch-routes.ts
dispatch_wiring: apps/api/src/app.ts
lazy_handlers: apps/api/src/boot/lazy-route-handlers.ts
scope: "8.1 only — GET/PATCH /urban/settings"
out_of_scope_8_1:
  ["/urban/catalog", "/urban/registrations", "/urban/admin/catalog", "/api/v2/tenant-config"]
```

---

## 1. `DISPATCH_ROUTES` array insertion contract

| Field               | Value                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Target file**     | `apps/api/src/openapi/dispatch-routes.ts`                                                         |
| **Anchor row**      | Last existing entry `patchTour` (`PATCH /tours/{tourId}`)                                         |
| **Insertion index** | Immediately **after** `patchTour` · immediately **before** `] as const`                           |
| **Block label**     | `// Phase 8.1 — urban owner settings (INV-P8-007)`                                                |
| **Type**            | `DispatchRoute` — same shape as trunk (`method`, `path`, `summary`, `operationId`; no `internal`) |
| **Count**           | **+2** rows (8.1 surface only)                                                                    |
| **Parity gate**     | `pnpm run guard:openapi-dispatch-parity` after `app.ts` branches land                             |

### Literal insertion payload

```typescript
  // Phase 8.1 — urban owner settings (INV-P8-007)
  {
    method: "GET",
    path: "/urban/settings",
    summary: "Read urban workspace owner settings (tenants.theme.urban)",
    operationId: "getUrbanSettings",
  },
  {
    method: "PATCH",
    path: "/urban/settings",
    summary: "Patch urban workspace owner settings (tenants.theme.urban)",
    operationId: "patchUrbanSettings",
  },
```

### Post-insert inventory sequence (tail)

| Index | `operationId`        | `method` | `path`            |
| ----- | -------------------- | -------- | ----------------- |
| n−1   | `patchTour`          | `PATCH`  | `/tours/{tourId}` |
| n     | `getUrbanSettings`   | `GET`    | `/urban/settings` |
| n+1   | `patchUrbanSettings` | `PATCH`  | `/urban/settings` |

---

## 2. `app.ts` dispatch branch contract (parity with inventory)

| `operationId`        | `app.ts` condition                                         | Handler import                      |
| -------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `getUrbanSettings`   | `method === "GET" && url.pathname === "/urban/settings"`   | `handlers.handleGetUrbanSettings`   |
| `patchUrbanSettings` | `method === "PATCH" && url.pathname === "/urban/settings"` | `handlers.handlePatchUrbanSettings` |

**Placement:** After `/tours/{tourId}` block · before `sendHttpError(404)`.

**`lazy-route-handlers.ts` exports to add:**

| Export                     | Source module                                 |
| -------------------------- | --------------------------------------------- |
| `handleGetUrbanSettings`   | `apps/api/src/urban/urban-settings.routes.ts` |
| `handlePatchUrbanSettings` | `apps/api/src/urban/urban-settings.routes.ts` |

---

## 3. Phase 8.1 route binding matrix

| HTTP method & path      | `operationId`        | Target controller handler                                                  | Enforced middleware hook                                                                                                                                |
| ----------------------- | -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /urban/settings`   | `getUrbanSettings`   | `handleGetUrbanSettings` · `apps/api/src/urban/urban-settings.routes.ts`   | `assertWorkspaceOwner({ surface: "urban.settings.read" })` · `apps/api/src/urban/require-workspace-owner.ts` — **before** `runWithHttpRequestContext`   |
| `PATCH /urban/settings` | `patchUrbanSettings` | `handlePatchUrbanSettings` · `apps/api/src/urban/urban-settings.routes.ts` | `assertWorkspaceOwner({ surface: "urban.settings.update" })` · `apps/api/src/urban/require-workspace-owner.ts` — **before** `runWithHttpRequestContext` |

### Per-handler pipeline (both rows)

| Step | Function                                                                                                                                                                                        | File                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | `resolveTenantContextFromRequest(req)`                                                                                                                                                          | `apps/api/src/tenant-kernel/tenant-kernel.ts`     |
| 2    | `resolveWorkspaceTypeForTenant(auth.tenantId)`                                                                                                                                                  | `apps/api/src/tenant/resolve-workspace-type.ts`   |
| 3    | `buildTenantAuthz(auth)`                                                                                                                                                                        | `packages/workspace-sdk/src/auth/tenant-authz.ts` |
| 4    | `assertWorkspaceOwner({ auth, workspaceType, surface })`                                                                                                                                        | `apps/api/src/urban/require-workspace-owner.ts`   |
| 5    | `runWithHttpRequestContext(req, auth, handlerBody, { rateLimit: "read" \| "write" })`                                                                                                           | `apps/api/src/http/bind-request-context.ts`       |
| 6    | **Inside `handlerBody` only** (after steps 1–4): GET read `tenants.theme.urban` · PATCH `readUrbanSettingsRequestBody` → `parseUrbanSettingsPatchBody` → `UrbanSettingsService.patchThemeUrban` | `apps/api/src/urban/urban-settings.routes.ts`     |
| 7    | `handleHttpError(res, error)` on catch                                                                                                                                                          | `apps/api/src/middleware/error-interceptor.ts`    |

| `operationId`        | `runWithHttpRequestContext` `rateLimit` | Deny HTTP status | Deny body `code`       |
| -------------------- | --------------------------------------- | ---------------- | ---------------------- |
| `getUrbanSettings`   | `"read"`                                | **403**          | `URBAN_OWNER_REQUIRED` |
| `patchUrbanSettings` | `"write"`                               | **403**          | `URBAN_OWNER_REQUIRED` |

**Deny mapping:** `UrbanOwnerRequiredError` → `error-interceptor.ts` → **403** + `URBAN_OWNER_REQUIRED` + `x-correlation-id` (CASL-URBAN-OWNER-SPEC § API error catalog).

---

## 4. `PATCH /urban/settings` — Zod validation binding

| Field                             | Value                                                                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Canonical Zod SoT (normative)** | [`schemas/URBAN-SETTINGS-PATCH.zod.ts`](schemas/URBAN-SETTINGS-PATCH.zod.ts) — **sole** field contract · **no** inline `z.object` duplicates in this addendum                                            |
| **Trunk mirror module**           | `apps/api/src/urban/schemas/urban-settings-patch.schema.ts` — MUST match canonical exports byte-for-byte at implementation time                                                                          |
| **Schema export**                 | `urbanSettingsPatchBodySchema`                                                                                                                                                                           |
| **Parser export**                 | `parseUrbanSettingsPatchBody(raw: unknown): UrbanSettingsPatchBody`                                                                                                                                      |
| **Type export**                   | `UrbanSettingsPatchBody` = `z.infer<typeof urbanSettingsPatchBodySchema>`                                                                                                                                |
| **Body reader**                   | `readUrbanSettingsRequestBody(req)` · `apps/api/src/urban/read-urban-settings-request-body.ts`                                                                                                           |
| **Route call site**               | `handlePatchUrbanSettings` → `parseUrbanSettingsPatchBody(parsedBody)` **inside** step 5 `handlerBody` — **after** steps 1–4 (`assertWorkspaceOwner` complete)                                           |
| **Validation failure**            | `parseUrbanSettingsPatchBody` throws `Error("ZOD_VALIDATION_FAILED: ${joinedIssueMessages}")` per canonical parser → `handleHttpError` → **400** (`error-interceptor.ts` `mapErrorMessageToStatus` L146) |
| **Persist target**                | `tenants.theme` JSON merge at key `urban` (Prisma `Tenant.theme`) — merge defaults: [`URBAN-THEME-MERGE-ALGORITHM.md`](URBAN-THEME-MERGE-ALGORITHM.md)                                                   |
| **Service delegate**              | `UrbanSettingsService.patchThemeUrban(auth, body)` · `apps/api/src/urban/urban-settings.service.ts`                                                                                                      |

### Canonical Zod schema (normative — agents MUST read file, MUST NOT invent shapes)

**Authority:** [`docs/phase-8/appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts`](schemas/URBAN-SETTINGS-PATCH.zod.ts)

| Rule             | Binding                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FORBIDDEN**    | Inline `z.object` stubs · ellipsized field tables · partial schema copies in this addendum                                                                                    |
| **REQUIRED**     | Import or copy from [`schemas/URBAN-SETTINGS-PATCH.zod.ts`](schemas/URBAN-SETTINGS-PATCH.zod.ts) only                                                                         |
| **Exports**      | `urbanSettingsPatchBodySchema` · `UrbanSettingsPatchBody` · `parseUrbanSettingsPatchBody`                                                                                     |
| **Strictness**   | `.strict()` on every object in canonical file — `additionalProperties: false` at runtime                                                                                      |
| **Root shape**   | `{ urban: { catalog: { publicEnabled, slug }, registration: { policy, requirePhone?, confirmationMessage? } } }` — field types and constraints defined only in canonical file |
| **HTTP mapping** | Invalid body → `ZOD_VALIDATION_FAILED` prefix in thrown `Error.message` → **400**                                                                                             |

### HTTP 200 response shapes (DEC-P8-003)

| `operationId`        | Status  | Body contract                            | Authority                                                                                |
| -------------------- | ------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `getUrbanSettings`   | **200** | `{ success, data: { urban }, metadata }` | [`schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml) |
| `patchUrbanSettings` | **200** | `{ urban: theme.urban }`                 | [`URBAN-THEME-MERGE-ALGORITHM.md`](URBAN-THEME-MERGE-ALGORITHM.md) § PATCH               |

### `handleGetUrbanSettings` binding excerpt (target)

```typescript
const auth = await resolveTenantContextFromRequest(req);
const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
assertWorkspaceOwner({ auth, workspaceType, surface: "urban.settings.read" });
await runWithHttpRequestContext(
  req,
  auth,
  async () => {
    const theme = await deps.urbanSettingsService.readThemeUrban(auth);
    sendJson(res, 200, {
      success: true,
      data: { urban: theme.urban },
      metadata: {
        tenantId: auth.tenantId,
        workspaceId: auth.workspaceId,
        workspaceType,
        correlationId: requireActiveTraceId(),
        primaryColor: theme.primaryColor ?? null,
        featureFlags: theme.featureFlags ?? null,
        rateLimitRps: theme.rateLimitRps ?? null,
      },
    });
  },
  { rateLimit: "read" }
);
```

### `handlePatchUrbanSettings` binding excerpt (target)

```typescript
const auth = await resolveTenantContextFromRequest(req);
const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
assertWorkspaceOwner({ auth, workspaceType, surface: "urban.settings.update" });
await runWithHttpRequestContext(
  req,
  auth,
  async () => {
    const { parsedBody } = await readUrbanSettingsRequestBody(req);
    const body = parseUrbanSettingsPatchBody(parsedBody);
    const theme = await deps.urbanSettingsService.patchThemeUrban(auth, body);
    sendJson(res, 200, { urban: theme.urban });
  },
  { rateLimit: "write" }
);
```

---

## 5. OpenAPI / shadow-API verification

```bash
cd apps/api
pnpm run openapi:generate
pnpm run guard:openapi-dispatch-parity
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
```

| Check                                                                     | Pass                                   |
| ------------------------------------------------------------------------- | -------------------------------------- |
| `openapi/openapi.json` contains `getUrbanSettings` · `patchUrbanSettings` | required                               |
| `guard:openapi-dispatch-parity` inventory ↔ `app.ts` ↔ spec               | exit 0                                 |
| Member/admin `PATCH /urban/settings`                                      | **403** `URBAN_OWNER_REQUIRED`         |
| Owner `PATCH` invalid slug                                                | **400** `ZOD_VALIDATION_FAILED` mapped |
| Owner `PATCH` valid body                                                  | **200**                                |

---

## 6. Cross-reference

| Doc                                                                                                              | Binding                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md)                                                           | Surface → route table · `assertWorkspaceOwner`                   |
| [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md)                                                                 | §C settings rows · rate-limit bucket `GET/PATCH:/urban/settings` |
| [`URBAN-PRODUCT-SCOPE.md`](URBAN-PRODUCT-SCOPE.md)                                                               | Theme JSON field registry                                        |
| [`schemas/URBAN-SETTINGS-PATCH.zod.ts`](schemas/URBAN-SETTINGS-PATCH.zod.ts)                                     | PATCH body Zod SoT — §4 canonical schema                         |
| [`schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml)                         | GET **200** response envelope                                    |
| [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md)                                    | CP-8.1-03 HTTP proof                                             |
| [`../../phase-5/appendices/openapi-dispatch-contract.md`](../../phase-5/appendices/openapi-dispatch-contract.md) | DEC-099 inventory SoT                                            |
