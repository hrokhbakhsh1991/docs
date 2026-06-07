# Urban route matrix — HTTP + Web access control

```yaml
matrix_version: "2026-06-07-v1"
authority: phase-8-agent-router.md §3.2 · CASL-URBAN-OWNER-SPEC.md · INV-P8-007 · DEC-P8-001
workspace_plugin: "@app-tour/workspace-urban"
workspace_type: urban
fail_closed: true
single_owner_surfaces: ["workspace_settings", "catalog_admin", "publish_mutation"]
```

## Binding law

| Law             | Rule                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-P8-007**  | Urban **configuration mutations** (settings, catalog admin, publish/unpublish) require **Workspace `owner` role** with active membership. `admin`, `member`, `viewer`, anonymous → **403** on those rows. |
| **RULE-P8-004** | Urban admin CASL checks MUST call `isWorkspaceOwner(context)` — **not** `isAdminOrOwner` — before handler body on owner-only rows below.                                                                  |
| **MAP §12 R4**  | Public routes are throttled per tenant tier. Missing auth on owner rows → **403**, never redirect-to-login loops on API.                                                                                  |
| **INV-P8-002**  | Route modules live under `apps/api/src/urban/**` — no `URBAN_*` branches in generic middleware.                                                                                                           |

**CASL foundation:** `packages/workspace-sdk/src/auth/casl/index.ts` — `defineAbilityFor`. Urban product routes add **RULE-P8-004** owner gate on top of ability checks where marked `OwnerOnly`.

**Rate-limit foundation:** `apps/api/src/middleware/tenant-rate-limiter.ts` — key pattern `ratelimit:{tenantId}:{tier}:{method}:{pathTemplate}` (extends Phase 7.6 `RULE-P7-006`).

---

## Actor vocabulary

| Actor           | Definition                                                                                                 | ALS / session                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Anonymous**   | No `Authorization` header; tenant resolved from host / `X-Tenant-Id` bootstrap                             | Guest ability (`GUEST_APP_ABILITY` on web)    |
| **Member**      | Authenticated `role=member` only (`TenantAuthContext` — legacy `leader` / `viewer` labels map to `member`) | `buildTenantAuthz` — may read workspace shell |
| **Owner**       | Authenticated `role=owner` only                                                                            | `isWorkspaceOwner(context) === true`          |
| **PlatformOps** | Internal provisioner — not product UI                                                                      | Internal routes only (8.3 fixtures)           |

---

## API routes (`@apps/api`)

Target module: `apps/api/src/urban/urban.routes.ts`  
Target dispatch registration: `apps/api/src/openapi/dispatch-routes.ts` (Phase 8.2 — **not yet in trunk**).

### A. Public catalog (read-only)

| METHOD | PATH                      | ACTOR     | CASL SUBJECT / ACTION                                                                              | EXPECTED STATUS                                              | RATE LIMIT BOUNDARY                                                                                                                  |
| ------ | ------------------------- | --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/urban/catalog`          | Anonymous | `Read` · `CanonicalDocument` · `{ tenantId }` + server filter `publishStatus=published`            | **200** (empty list OK) · **404** if tenant not urban        | `ratelimit:{tenantId}:pool:GET:/urban/catalog` — **120 RPM** pool · **300 RPM** silo (`RATE_LIMIT_POOL_RPM` / `RATE_LIMIT_SILO_RPM`) |
| GET    | `/urban/catalog/{tourId}` | Anonymous | `Read` · `CanonicalDocument` · `{ tenantId, documentId: tourId }` + published guard                | **200** · **404** unpublished/missing · **403** wrong tenant | Same as list                                                                                                                         |
| GET    | `/tours`                  | Anonymous | `Read` · `CanonicalDocument` · **only when** `?visibility=public` query set by urban route wrapper | **200** paginated                                            | Inherited urban catalog bucket                                                                                                       |
| GET    | `/tours/{tourId}`         | Anonymous | `Read` · `CanonicalDocument` · published tour only                                                 | **200** · **404** if draft                                   | Inherited urban catalog bucket                                                                                                       |

**Query contract (GET `/urban/catalog`):**

```text
?cursor=<opaque>&limit=20&city=<string>&sort=publishedAt:desc
```

**O(log N) index:** `idx_tours_tenant_publish_catalog` on `(tenant_id, publish_status, published_at DESC)` — see [`URBAN-PRODUCT-SCOPE.md`](URBAN-PRODUCT-SCOPE.md).

### B. Public registration / waitlist intake

| METHOD | PATH                   | ACTOR     | CASL SUBJECT / ACTION                                                                                           | EXPECTED STATUS                                                                   | RATE LIMIT BOUNDARY                                                                       |
| ------ | ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/urban/registrations` | Anonymous | `Create` · `CanonicalDocument` · `{ tenantId }` — body validated by `getUrbanWorkspacePlugin().validationHooks` | **201** + registration id · **400** validation · **409** duplicate email per tour | `ratelimit:{tenantId}:pool:POST:/urban/registrations` — **30 RPM** pool · **60 RPM** silo |
| POST   | `/urban/registrations` | Member    | Same as Anonymous — registration is **public intake**                                                           | **201** / **400** / **409** — never requires owner                                | Same bucket (not elevated)                                                                |

**Idempotency:** `Idempotency-Key` header required — reuses `HttpIdempotencyRecord` (Phase 5 DEC-006). No new outbox table (TQ-P8-006).

### C. Workspace settings (owner-only)

| METHOD | PATH                    | ACTOR                      | CASL SUBJECT / ACTION                                                                                                                          | EXPECTED STATUS                                               | RATE LIMIT BOUNDARY                                                          |
| ------ | ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/urban/settings`       | Owner                      | `Read` · `Workspace` · `workspaceScope` **AND** `Read` · `WorkspaceTheme` · `{ tenantId, workspaceId, pluginId: 'urban' }` **AND** RULE-P8-004 | **200** · **403** member/admin/anon                           | `ratelimit:{tenantId}:{tier}:GET:/urban/settings` — **60 RPM** authenticated |
| GET    | `/urban/settings`       | Member / Admin / Anonymous | —                                                                                                                                              | **403**                                                       | —                                                                            |
| PATCH  | `/urban/settings`       | Owner                      | `Update` · `WorkspaceTheme` · urban scope **AND** RULE-P8-004                                                                                  | **200** · **403** non-owner · **400** `ZOD_VALIDATION_FAILED` | **60 RPM** authenticated mutation bucket                                     |
| PATCH  | `/urban/settings`       | Member / Admin / Anonymous | —                                                                                                                                              | **403**                                                       | —                                                                            |
| PATCH  | `/api/v2/tenant-config` | Owner                      | `Update` · `Tenant` · `{ tenantId }` — **urban theme keys only** when `workspaceType=urban`                                                    | **200** / **403**                                             | Generic tenant-config bucket                                                 |

**Settings payload keys (theme JSON — no new Prisma model):**

```json
{
  "urban": {
    "catalog": { "publicEnabled": true, "slug": "tours" },
    "registration": { "policy": "waitlist", "requirePhone": false }
  }
}
```

### D. Catalog admin (owner-only)

| METHOD | PATH                            | ACTOR                      | CASL SUBJECT / ACTION                                                                         | EXPECTED STATUS                                 | RATE LIMIT BOUNDARY |
| ------ | ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- |
| GET    | `/urban/admin/catalog`          | Owner                      | `Read` · `CanonicalDocument` · all statuses **AND** RULE-P8-004                               | **200** (draft + published) · **403** non-owner | **60 RPM** auth     |
| GET    | `/urban/admin/catalog`          | Member / Admin / Anonymous | —                                                                                             | **403**                                         | —                   |
| PATCH  | `/urban/admin/catalog/{tourId}` | Owner                      | `Update` · `CanonicalDocument` · `{ tenantId, documentId }` **AND** RULE-P8-004               | **200** · **403** · **409** row version         | **60 RPM** auth     |
| DELETE | `/urban/admin/catalog/{tourId}` | Owner                      | `Delete` · `CanonicalDocument` · soft-delete via `publishStatus=archived` **AND** RULE-P8-004 | **204** · **403**                               | **30 RPM** auth     |

### E. Publish mutation (owner-only)

| METHOD | PATH                                | ACTOR  | CASL SUBJECT / ACTION                                                                                        | EXPECTED STATUS                                         | RATE LIMIT BOUNDARY                      |
| ------ | ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------- |
| POST   | `/urban/catalog/{tourId}/publish`   | Owner  | `Update` · `CanonicalDocument` · publish transition + plugin `validatePublish` hook **AND** RULE-P8-004      | **200** · **403** non-owner · **400** not publish-ready | **30 RPM** auth                          |
| POST   | `/urban/catalog/{tourId}/unpublish` | Owner  | `Update` · `CanonicalDocument` · `publishStatus=draft` **AND** RULE-P8-004                                   | **200** · **403**                                       | **30 RPM** auth                          |
| PATCH  | `/tours/{tourId}`                   | Owner  | `Update` · `CanonicalDocument` — **when body contains** `tour.status` or `publishStatus` **AND** RULE-P8-004 | **200** · **403** member · **409** lock                 | **60 RPM** auth                          |
| PATCH  | `/tours/{tourId}`                   | Member | Body touches `tour.status` / publish fields                                                                  | **403**                                                 | —                                        |
| POST   | `/tours`                            | Owner  | `Create` · `CanonicalDocument`                                                                               | **201**                                                 | Existing `POST /tours` limiter (DEC-015) |
| POST   | `/tours`                            | Member | `Create` · allowed per platform policy                                                                       | **201** or **403** per workspace policy                 | Existing limiter                         |

**Publish guard:** `getUrbanWorkspacePlugin().composites.urban.publishReadiness` must pass before `publishStatus=published`.

### F. Register tenant (platform — not urban product)

| METHOD | PATH                          | ACTOR       | CASL SUBJECT / ACTION                        | EXPECTED STATUS                 | RATE LIMIT BOUNDARY         |
| ------ | ----------------------------- | ----------- | -------------------------------------------- | ------------------------------- | --------------------------- |
| POST   | `/internal/tenants/provision` | PlatformOps | Internal only — `internal: true` in dispatch | **201** test env · **404** prod | N/A — not Phase 8.2 surface |

Urban **registration intake** is §B (`POST /urban/registrations`). Do not confuse with tenant provisioning.

---

## Web routes (`@apps/web`)

Target tree: `apps/web/app/(public)/` + `apps/web/app/(app)/settings/urban/`  
Shell: `force-dynamic` on owner settings (TQ-P8-008). Public catalog may use ISR **only** when `catalog.publicEnabled=true` and session not required — default **dynamic**.

### G. Public catalog (anonymous)

| METHOD | PATH                         | ACTOR     | CASL / GUARD                                           | EXPECTED STATUS                 | RATE LIMIT BOUNDARY         |
| ------ | ---------------------------- | --------- | ------------------------------------------------------ | ------------------------------- | --------------------------- |
| GET    | `/catalog`                   | Anonymous | Server fetches `GET /urban/catalog` — no owner session | **200** · **404** tenant        | Browser → API public bucket |
| GET    | `/catalog/[tourId]`          | Anonymous | Server fetches `GET /urban/catalog/{tourId}`           | **200** · **404** draft/missing | Same                        |
| GET    | `/catalog/[tourId]/register` | Anonymous | Registration form page — no auth                       | **200**                         | Same                        |

Legacy reference (read-only): `legacy/apps/web/app/(public)/catalog/page.tsx`.

### H. Registration submit (anonymous)

| METHOD | PATH                         | ACTOR          | CASL / GUARD                                | EXPECTED STATUS                                | RATE LIMIT BOUNDARY     |
| ------ | ---------------------------- | -------------- | ------------------------------------------- | ---------------------------------------------- | ----------------------- |
| POST   | `/catalog/[tourId]/register` | Anonymous      | Server action → `POST /urban/registrations` | **303** redirect success · **400** form errors | API registration bucket |
| POST   | `/catalog/[tourId]/register` | Owner / Member | Public intake — allowed                     | **303** / **400**                              | Same — not owner-gated  |

### I. Workspace settings (owner-only)

| METHOD | PATH              | ACTOR                      | CASL / GUARD                                                                                                                                                   | EXPECTED STATUS   | RATE LIMIT BOUNDARY |
| ------ | ----------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------- |
| GET    | `/settings/urban` | Owner                      | [`CANLOAD-URBAN-SETTINGS.contract.ts`](CANLOAD-URBAN-SETTINGS.contract.ts) — `canLoadUrbanSettings` → `canPerformUrbanOwnerMutation(..., urban.settings.read)` | **200**           | Session-bound       |
| GET    | `/settings/urban` | Member / Admin             | `WizardAccessDenied` or **403** page                                                                                                                           | **403** UI        | —                   |
| GET    | `/settings/urban` | Anonymous                  | Redirect login or **403**                                                                                                                                      | **401** / **403** | —                   |
| PATCH  | `/settings/urban` | Owner                      | Same guard + server action → `PATCH /urban/settings`                                                                                                           | **200** · **403** | Session-bound       |
| PATCH  | `/settings/urban` | Member / Admin / Anonymous | —                                                                                                                                                              | **403**           | —                   |

Target guard module: `apps/web/src/urban/urban-settings-access.ts` (8.1).

### J. Catalog admin + publish (owner-only)

| METHOD | PATH                                         | ACTOR                      | CASL / GUARD                                           | EXPECTED STATUS             | RATE LIMIT BOUNDARY |
| ------ | -------------------------------------------- | -------------------------- | ------------------------------------------------------ | --------------------------- | ------------------- |
| GET    | `/settings/urban/catalog`                    | Owner                      | Owner guard + admin catalog API                        | **200** · **403**           | Session-bound       |
| GET    | `/settings/urban/catalog`                    | Member / Admin / Anonymous | —                                                      | **403**                     | —                   |
| POST   | `/settings/urban/catalog/[tourId]/publish`   | Owner                      | Owner guard → `POST /urban/catalog/{tourId}/publish`   | **303** / **400** · **403** | Session-bound       |
| POST   | `/settings/urban/catalog/[tourId]/unpublish` | Owner                      | Owner guard → `POST /urban/catalog/{tourId}/unpublish` | **303** · **403**           | Session-bound       |

---

## RULE-P8-004 implementation contract

```typescript
// packages/workspace-sdk/src/auth/tenant-auth-grants.ts (8.1 — doc-first)
export function isWorkspaceOwner(context: TenantAuthContext): boolean {
  return context.role === "owner" && isActiveMember(context);
}

// apps/api/src/urban/require-workspace-owner.ts
export function assertWorkspaceOwner(params: AssertWorkspaceOwnerParams): void {
  // see CASL-URBAN-OWNER-SPEC.md — canPerformUrbanOwnerMutation
  throw new UrbanOwnerRequiredError(surface); // HTTP 403 URBAN_OWNER_REQUIRED
}
```

**Forbidden:** `isAdminOrOwner` as sole gate on rows marked OwnerOnly in this matrix.

---

## Verification

| Check                   | Command                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| Matrix file present     | `test -f docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md`                  |
| Owner routes documented | `rg 'OwnerOnly\|Owner \|' docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md` |
| 8.1 behavioral proof    | `pnpm --filter @apps/api test urban-settings-patch.spec.ts`              |
| 8.1 web proof           | `pnpm --filter @apps/web test urban-owner-access.spec.ts`                |
| SMK-P8 alignment        | [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md) (when authored)         |

**REQ:** REQ-P8-004 · REQ-P8-010 · REQ-P8-011 · REQ-P8-012 — see [`../audits/verification-matrix.md`](../audits/verification-matrix.md).
