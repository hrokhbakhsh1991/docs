# CASL / TenantAuthz — Urban Single-Owner enforcement spec

```yaml
spec_version: "2026-06-08-v3"
status: LOCKED
decisions: [DEC-P8-001, DEC-P8-002, DEC-P8-004]
invariants: [INV-P8-007, RULE-P8-004]
authority: phase-8-agent-router.md §3.2 · URBAN-ROUTE-MATRIX.md
implementation_phase: "8.1 (auth) before 8.2 (product routes)"
phase_10_trunk: docs/phase-10/subphases/10.5-sdk-neutral.md
```

## Phase 10.5 trunk mapping (authoritative for implementation)

| 8.1 spec symbol | Historical path (8.1 charter) | Trunk path (Phase 10) |
| --------------- | ----------------------------- | --------------------- |
| `canPerformUrbanOwnerMutation` | `TenantAuthz` method in `tenant-authz.ts` | `packages/workspaces/urban/src/auth/urban-owner-auth.ts` → `canPerformWorkspaceOwnerMutation` |
| `UrbanOwnerSurface` | `tenant-authz.ts` | `packages/workspaces/urban/src/auth/urban-owner-surface.ts` |
| `assertWorkspaceOwner` | `apps/api/src/urban/require-workspace-owner.ts` | `packages/workspaces/urban/src/http/require-workspace-owner.ts` |
| `UrbanOwnerRequiredError` | `apps/api/src/urban/urban-owner-required.error.ts` | `packages/workspaces/urban/src/http/errors/urban-owner-required.error.ts` |
| HTTP host wiring | `apps/api/src/urban/*.routes.ts` | `@app-tour/workspace-urban/http` + `apps/api/src/http/configure-urban-http-host.ts` |
| Owner ability spec | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` |

Sections below retain the **8.1 design narrative**; use the table above when tracing code on trunk.

## Problem statement

Trunk `buildTenantAuthz` (`packages/workspace-sdk/src/auth/tenant-authz.ts`) grants **any active member** `canUpdateCanonicalDocument` and `canUpdateWorkspace`, and grants **admin or owner** `canManageTenant` / `canInstallPlugin` via `isAdminOrOwner`. That model is correct for generic starter/denali workspaces but **violates INV-P8-007** on urban **configuration mutations** (settings, catalog admin, publish/unpublish).

Phase 8.1 does **not** replace `buildTenantAuthz`. It adds an **Urban Owner Mutation Layer** (DEC-P8-002) that gates urban-specific surfaces with `isWorkspaceOwner` exclusively.

---

## Architectural integration

### Layer stack (foundation → urban gate)

```text
┌─────────────────────────────────────────────────────────────────┐
│  HTTP handler (apps/api/src/urban/*.routes.ts)                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ① resolveTenantContextFromRequest(req)
          apps/api/src/tenant-kernel/tenant-kernel.ts
                                │
        ② resolveWorkspaceTypeForTenant(auth.tenantId)
          apps/api/src/tenant/resolve-workspace-type.ts
          (existing — returns "starter" | "denali" | "urban")
                                │
        ③ buildTenantAuthz(auth)
          packages/workspace-sdk/src/auth/tenant-authz.ts
                                │
        ④ assertWorkspaceOwner({ auth, authz, workspaceType, surface })
          apps/api/src/urban/require-workspace-owner.ts
          (throws UrbanOwnerRequiredError when surface is owner-only)
                                │
        ⑤ runWithHttpRequestContext(req, auth, handlerBody, rateLimitOpts)
          apps/api/src/http/bind-request-context.ts
                                │
        ⑥ Business logic + plugin validation + persist
└─────────────────────────────────────────────────────────────────┘
```

**Correction to narrative ordering:** `resolveTenantContextFromRequest` runs **before** `runWithHttpRequestContext`. `assertWorkspaceOwner` runs **after** auth resolution and **before** `runWithHttpRequestContext` on owner-only urban routes. Rate limiting and tenant ALS bind **inside** `runWithHttpRequestContext` — owner assertion is **outside** rate limit for fail-fast 403 without consuming write budget on denied actors.

### Web layer (parallel, not CASL duplicate)

```text
apps/web/app/(app)/settings/urban/page.tsx
  → canLoadUrbanSettings({ authz, tenantId, workspaceId, pluginId: "urban" })
     apps/web/src/urban/urban-settings-access.ts
  → on false: render WizardAccessDenied (apps/web/src/wizard/wizard-access-denied.tsx)
```

Web guards call the **same** `TenantAuthz` urban methods documented below — no duplicate `role === "owner"` string checks in components.

---

## `isWorkspaceOwner` — grant definition

**File (new export):** `packages/workspace-sdk/src/auth/tenant-auth-grants.ts`

```typescript
import type { TenantAuthContext } from "./auth-context";
import { isActiveMember } from "./tenant-auth-grants"; // co-located

/**
 * Urban Single-Owner (DEC-P8-001). True only for role=owner with ACTIVE membership.
 * Admin is explicitly NOT owner for urban configuration mutations.
 */
export function isWorkspaceOwner(context: TenantAuthContext): boolean {
  return isActiveMember(context) && context.role === "owner";
}
```

**Override rule vs `isAdminOrOwner`:**

| Function           | `role=owner` | `role=admin` | `role=member` | Urban owner-only surfaces |
| ------------------ | ------------ | ------------ | ------------- | ------------------------- |
| `isAdminOrOwner`   | true         | **true**     | false         | **Must not be used**      |
| `isWorkspaceOwner` | **true**     | **false**    | false         | **Sole gate**             |

For `workspaceType !== "urban"`, existing `isAdminOrOwner` behavior on `canManageTenant` / `canInstallPlugin` is **unchanged**. Urban override applies **only** when `workspaceType === "urban"` **and** `surface` ∈ `UrbanOwnerSurface` (below).

---

## `TenantAuthz` extension (DEC-P8-002)

**File:** `packages/workspace-sdk/src/auth/tenant-authz.ts`

Add methods to `TenantAuthz` type and `buildTenantAuthz` implementation:

```typescript
export type UrbanOwnerSurface =
  | "urban.settings.read"
  | "urban.settings.update"
  | "urban.catalog.admin.read"
  | "urban.catalog.admin.update"
  | "urban.catalog.admin.delete"
  | "urban.catalog.publish"
  | "urban.catalog.unpublish"
  | "urban.tour.publish_fields";

export type TenantAuthz = {
  readonly context: Readonly<TenantAuthContext>;
  canReadWorkspace(tenantId: string, workspaceId: string): boolean;
  canUpdateWorkspace(tenantId: string, workspaceId: string): boolean;
  canReadTenant(tenantId: string): boolean;
  canManageTenant(tenantId: string): boolean;
  canReadPlugin(subject: PluginSubject): boolean;
  canInstallPlugin(subject: PluginSubject): boolean;
  canAccessWorkspaceTheme(params: {
    access: WorkspaceThemeSubject;
    pluginId: string;
    boundTenantId?: string;
  }): boolean;
  canReadCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
  canCreateCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
  canUpdateCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
  canPerformUrbanOwnerMutation(
    tenantId: string,
    surface: UrbanOwnerSurface,
    workspaceType: string
  ): boolean;
};
```

**Implementation contract (`buildTenantAuthz`):**

```typescript
canPerformUrbanOwnerMutation(tenantId, surface, workspaceType) {
  if (workspaceType !== "urban") {
    return false; // not an urban owner surface — caller uses generic authz
  }
  if (!granted || !tenantScopeMatches(parsed, tenantId)) {
    return false;
  }
  if (!isWorkspaceOwner(parsed)) {
    return false;
  }
  return URBAN_OWNER_SURFACE_ALLOWLIST.has(surface);
}

const URBAN_OWNER_SURFACE_ALLOWLIST: ReadonlySet<UrbanOwnerSurface> = new Set([
  "urban.settings.read",
  "urban.settings.update",
  "urban.catalog.admin.read",
  "urban.catalog.admin.update",
  "urban.catalog.admin.delete",
  "urban.catalog.publish",
  "urban.catalog.unpublish",
  "urban.tour.publish_fields",
]);
```

**Public catalog / registration (not in allowlist):** use existing `canReadCanonicalDocument` / anonymous handlers — **no** `canPerformUrbanOwnerMutation` call.

**CASL bridge (`defineAbilityFor`):** deprecated for API; if web still uses CASL Ability, map urban owner checks to `authz.canPerformUrbanOwnerMutation` in `canLoadUrbanSettings` — do **not** add parallel `ability.can("manage", "Workspace")` for urban settings.

---

## API middleware — `assertWorkspaceOwner`

**File (new):** `apps/api/src/urban/require-workspace-owner.ts`

```typescript
import type { TenantAuthContext, TenantAuthz, UrbanOwnerSurface } from "@app-tour/workspace-sdk";
import { buildTenantAuthz } from "@app-tour/workspace-sdk";
import { UrbanOwnerRequiredError } from "./urban-owner-required.error";

export type AssertWorkspaceOwnerParams = {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: UrbanOwnerSurface;
  readonly authz?: TenantAuthz;
};

export function assertWorkspaceOwner(params: AssertWorkspaceOwnerParams): void {
  const authz = params.authz ?? buildTenantAuthz(params.auth);
  if (
    !authz.canPerformUrbanOwnerMutation(params.auth.tenantId, params.surface, params.workspaceType)
  ) {
    throw new UrbanOwnerRequiredError(params.surface);
  }
}
```

**Handler templates (owner-only urban routes):**

**GET response contract (normative):** **DEC-P8-003** · [`schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml`](schemas/URBAN-SETTINGS-HTTP-ENVELOPE.yaml). **Forbidden on GET 200:** bare `{ urban: theme.urban }` without `success` / `data` / `metadata`.

```typescript
import { requireActiveTraceId } from "../observability/trace-request-context";

export async function handleGetUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse,
  deps: UrbanRouteDeps
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.read",
    });

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
  } catch (error) {
    handleHttpError(res, error);
  }
}
```

**PATCH persist contract (normative):** After `assertWorkspaceOwner` and inside `runWithHttpRequestContext`, the handler **MUST** call `UrbanSettingsService.patchThemeUrban(auth, body)` (`apps/api/src/urban/urban-settings.service.ts`), which performs a **deep merge** of the validated `urban` subtree into the existing `tenants.theme` JSONB column (Prisma `Tenant.theme`) at key `urban`. **PATCH 200** returns `{ urban: theme.urban }` only (DEC-P8-003). **Forbidden:** shallow replace of the full `theme` object · stub returns without Prisma write · persist placeholders.

```typescript
export async function handlePatchUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse,
  deps: UrbanRouteDeps
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.update",
    });

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
  } catch (error) {
    handleHttpError(res, error);
  }
}
```

**Surface → route mapping (verification):**

| HTTP route                               | `UrbanOwnerSurface`          |
| ---------------------------------------- | ---------------------------- |
| `GET /urban/settings`                    | `urban.settings.read`        |
| `PATCH /urban/settings`                  | `urban.settings.update`      |
| `GET /urban/admin/catalog`               | `urban.catalog.admin.read`   |
| `PATCH /urban/admin/catalog/{tourId}`    | `urban.catalog.admin.update` |
| `DELETE /urban/admin/catalog/{tourId}`   | `urban.catalog.admin.delete` |
| `POST /urban/catalog/{tourId}/publish`   | `urban.catalog.publish`      |
| `POST /urban/catalog/{tourId}/unpublish` | `urban.catalog.unpublish`    |
| `PATCH /tours/{tourId}` (publish fields) | `urban.tour.publish_fields`  |

Full matrix: [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md).

---

## API error catalog — `URBAN_OWNER_REQUIRED`

**File (new):** `apps/api/src/urban/urban-owner-required.error.ts`

```typescript
export const URBAN_OWNER_REQUIRED = "URBAN_OWNER_REQUIRED" as const;

export class UrbanOwnerRequiredError extends Error {
  readonly code = URBAN_OWNER_REQUIRED;
  readonly surface: string;

  constructor(surface: string) {
    super(URBAN_OWNER_REQUIRED);
    this.name = "UrbanOwnerRequiredError";
    this.surface = surface;
  }
}
```

**Error interceptor registration:** `apps/api/src/middleware/error-interceptor.ts`

Add discriminator (mirror `InvalidTenantAuthContextError` pattern):

```typescript
function isUrbanOwnerRequiredError(error: unknown): error is UrbanOwnerRequiredError {
  return error instanceof UrbanOwnerRequiredError;
}

// inside handleHttpError, before generic 500:
if (isUrbanOwnerRequiredError(error)) {
  sendHttpError(
    res,
    403,
    { error: URBAN_OWNER_REQUIRED, code: URBAN_OWNER_REQUIRED },
    correlationId
  );
  return;
}
```

**HTTP response contract (403):**

| Field                | Value                         |
| -------------------- | ----------------------------- |
| Status               | `403 Forbidden`               |
| Header               | `x-correlation-id: <traceId>` |
| Body `error`         | `"URBAN_OWNER_REQUIRED"`      |
| Body `code`          | `"URBAN_OWNER_REQUIRED"`      |
| Body `correlationId` | same as header                |

**Example payload:**

```json
{
  "error": "URBAN_OWNER_REQUIRED",
  "code": "URBAN_OWNER_REQUIRED",
  "correlationId": "01JXSAMPLECORRELATIONID00000001"
}
```

**Forbidden:** `302` redirect to login on API owner routes. **Forbidden:** `200` with empty body for denied actors.

**Metrics (optional 8.1):** `urban_owner_required_total{surface}` counter in handler catch — document in 8.5 observability; not blocking 8.1.

---

## Authorization outcome matrix

**Scope:** `workspaceType === "urban"` · tenant scope matched · `status === ACTIVE` · member has workspace binding when `role=member`.

**Legend:** `ALLOW` = operation permitted · `DENY` = **403** `URBAN_OWNER_REQUIRED` or generic `FORBIDDEN_*` · `PUBLIC` = no auth required · `N/A` = use generic non-urban workspace rules.

### Catalog (public)

| Actor         | Read                           | Create                               | Update | Delete | Publish |
| ------------- | ------------------------------ | ------------------------------------ | ------ | ------ | ------- |
| **Owner**     | PUBLIC (`GET /urban/catalog*`) | PUBLIC (`POST /urban/registrations`) | N/A    | N/A    | N/A     |
| **Admin**     | PUBLIC                         | PUBLIC                               | N/A    | N/A    | N/A     |
| **Member**    | PUBLIC                         | PUBLIC                               | N/A    | N/A    | N/A     |
| **Anonymous** | PUBLIC                         | PUBLIC                               | N/A    | N/A    | N/A     |

### Catalog (admin — draft/unpublished management)

| Actor         | Read                               | Create                                                    | Update                                                                      | Delete                               | Publish                         |
| ------------- | ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ | ------------------------------- |
| **Owner**     | ALLOW (`urban.catalog.admin.read`) | ALLOW via `POST /tours` generic                           | ALLOW (`urban.catalog.admin.update`)                                        | ALLOW (`urban.catalog.admin.delete`) | ALLOW (`urban.catalog.publish`) |
| **Admin**     | **DENY**                           | ALLOW generic tour create if `canCreateCanonicalDocument` | **DENY** on admin routes · generic tour patch without publish fields: ALLOW | **DENY**                             | **DENY**                        |
| **Member**    | **DENY**                           | ALLOW generic if tenant policy permits                    | **DENY** on admin routes · generic draft patch: ALLOW                       | **DENY**                             | **DENY**                        |
| **Anonymous** | **DENY**                           | **DENY**                                                  | **DENY**                                                                    | **DENY**                             | **DENY**                        |

### Settings (`tenants.theme.urban` JSON)

| Actor         | Read                          | Create | Update                          | Delete | Publish |
| ------------- | ----------------------------- | ------ | ------------------------------- | ------ | ------- |
| **Owner**     | ALLOW (`urban.settings.read`) | N/A    | ALLOW (`urban.settings.update`) | N/A    | N/A     |
| **Admin**     | **DENY**                      | N/A    | **DENY**                        | N/A    | N/A     |
| **Member**    | **DENY**                      | N/A    | **DENY**                        | N/A    | N/A     |
| **Anonymous** | **DENY**                      | N/A    | **DENY**                        | N/A    | N/A     |

### Theme (`WorkspaceTheme` / `canAccessWorkspaceTheme`)

| Actor         | Read                                                              | Create | Update                                          | Delete | Publish |
| ------------- | ----------------------------------------------------------------- | ------ | ----------------------------------------------- | ------ | ------- |
| **Owner**     | ALLOW (`canAccessWorkspaceTheme` + owner surface for settings UI) | N/A    | ALLOW (`urban.settings.update` — theme ingress) | N/A    | N/A     |
| **Admin**     | ALLOW (`canAccessWorkspaceTheme` — **read theme shell only**)     | N/A    | **DENY** (`urban.settings.update`)              | N/A    | N/A     |
| **Member**    | ALLOW (`canAccessWorkspaceTheme` — read only)                     | N/A    | **DENY**                                        | N/A    | N/A     |
| **Anonymous** | **DENY**                                                          | N/A    | **DENY**                                        | N/A    | N/A     |

### Tours (canonical document — urban tenant)

| Actor         | Read                                  | Create                                | Update (draft fields)              | Delete           | Publish (`publishStatus` / `tour.status`)                     |
| ------------- | ------------------------------------- | ------------------------------------- | ---------------------------------- | ---------------- | ------------------------------------------------------------- |
| **Owner**     | ALLOW published public / all in admin | ALLOW                                 | ALLOW                              | ALLOW (archive)  | ALLOW (`urban.tour.publish_fields` / `urban.catalog.publish`) |
| **Admin**     | ALLOW                                 | ALLOW if `canCreateCanonicalDocument` | ALLOW **excluding** publish fields | **DENY** archive | **DENY**                                                      |
| **Member**    | ALLOW public published only           | ALLOW if policy permits               | ALLOW **excluding** publish fields | **DENY**         | **DENY**                                                      |
| **Anonymous** | PUBLIC published only                 | **DENY**                              | **DENY**                           | **DENY**         | **DENY**                                                      |

**Publish field detection (API):** `PATCH /tours/{tourId}` body contains any of `publishStatus`, `tour.status`, `tour.publishedAt`, or `tour.publishStatus` in canonical patch → require `urban.tour.publish_fields` when `workspaceType=urban`.

---

## Verification artifacts (8.1)

| Artifact                          | Path                                                      | Proves                                                          |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| SDK grant + urban owner helper | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` | `isWorkspaceOwner` · `canPerformUrbanOwnerMutation` matrix rows (SDK-8.1-01..08) |
| API middleware + error code       | `apps/api/test/urban-owner-ability.spec.ts`               | `assertWorkspaceOwner` · **403** + `URBAN_OWNER_REQUIRED` JSON  |
| HTTP route integration            | `apps/api/test/urban-settings-patch.spec.ts`              | `PATCH /urban/settings` member/admin → 403 · owner → 200        |
| Web guard                         | `apps/web/test/urban-owner-access.spec.ts`                | `canLoadUrbanSettings` deny/allow                               |

**Commands:**

```bash
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts
```

**REQ:** REQ-P8-010 · REQ-P8-011 · REQ-P8-012 · RULE-P8-004 — [`../audits/verification-matrix.md`](../audits/verification-matrix.md).

---

## Forbidden patterns (RULE-P8-004)

| Pattern                                                             | Detection                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `isAdminOrOwner` on urban owner surfaces                            | `rg 'isAdminOrOwner' apps/api/src/urban apps/web/src/urban` → **FAIL** |
| `role === "owner"` in route handlers without `assertWorkspaceOwner` | `rg 'role === .owner.' apps/api/src/urban` → must only appear in tests |
| `ability.can("manage", "Workspace")` as sole urban settings gate    | grep in `apps/web` urban settings paths → **FAIL**                     |
| Admin bypass comment `// TODO owner`                                | `rg 'TODO.*owner' apps/api/src/urban apps/web` → **FAIL**              |
