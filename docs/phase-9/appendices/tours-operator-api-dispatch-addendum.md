# Phase 9.3 — Tours operator API dispatch addendum

```yaml
addendum_id: DISPATCH-P9-TOURS
version: "2026-06-08-v2"
authority: ADMIN-ROUTE-MATRIX.md · DEC-P9-007 · DEC-P9-014 · TOURS-LIST-UX.md
target: apps/api/src/openapi/dispatch-routes.ts
guard: p9_tours_list_pack
extends: docs/phase-5/appendices/tours-list-endpoint.md
```

## Dispatch operations (9.3)

| operationId | Method | Path          | Handler target                        | Session                                                              |
| ----------- | ------ | ------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `listTours` | GET    | `/tours`      | `apps/api/src/tours/list.handler.ts`  | `requireOperatorSession` (operator view) · tenant kernel (slim view) |
| `getTour`   | GET    | `/tours/{id}` | `apps/api/src/tours/get.handler.ts`   | `requireOperatorSession`                                             |
| `patchTour` | PATCH  | `/tours/{id}` | `apps/api/src/tours/patch.handler.ts` | `requireOperatorSession` + tour ACL                                  |

**Wizard create** remains Phase 6 root route — **not** registered under `(app)/`:

| operationId        | Method | Path     | Notes                                                 |
| ------------------ | ------ | -------- | ----------------------------------------------------- |
| `createTourWizard` | POST   | `/tours` | Existing Phase 6 handler — nav link `/tours/new` only |

---

## GET /tours — dual view contract (DEC-P9-014)

### Query parameters — operator view (`view=operator` default for authenticated operator session)

| Param           | Type                              | Default                          | Notes                              |
| --------------- | --------------------------------- | -------------------------------- | ---------------------------------- |
| `view`          | `slim \| operator`                | `operator` when operator session | `slim` = Phase 5 cursor index      |
| `search`        | string                            | —                                | max 200 · title + shortDescription |
| `status`        | `active \| completed \| archived` | —                                | legacy lifecycle buckets           |
| `category`      | Denali tour kind slug             | —                                | exact match on `TourListProjection.category` · invalid slug ignored |
| `page`          | int ≥1                            | 1                                | offset pagination                  |
| `limit`         | int                               | 10 (operator) / 50 (slim)        | max 100                            |
| `sort_by`       | `created_at \| title \| price \| departure_at` | `created_at`          | `departure_at` nulls sort last (2026-06-24) |
| `sort_dir`      | `asc \| desc`                     | `desc`                           |                                    |
| `include_total` | bool                              | true                             |                                    |
| `cursor`        | string                            | —                                | **slim only**                      |

### Response — operator view

```json
{
  "items": [{ "$ref": "TOURS-LIST-PROJECTION.schema.json" }],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

Schema: [`schemas/TOURS-LIST-PROJECTION.schema.json`](schemas/TOURS-LIST-PROJECTION.schema.json)

### Response — slim view (unchanged Phase 5)

```json
{
  "items": [
    { "id": "...", "tenantId": "...", "createdAt": "...", "rowVersion": 1 }
  ],
  "nextCursor": "..." | null
}
```

---

## Handler branch logic

```typescript
// list.handler.ts (pseudocode)
const query = parseListToursQuery(url.searchParams);
if (query.view === "operator") {
  await requireOperatorSession(req);
  return listToursOperator(auth, parseOperatorListQuery(url.searchParams));
}
return listToursSlim(auth, query); // Phase 5 path — backward compatible
```

---

## Workspace plugin hook

```typescript
// workspace-sdk contract (doc-first)
export interface TourListProjectionExtractor {
  extractTourListProjection(canonical: CanonicalDocument): TourListProjectionFields;
}
```

Denali implementation: `packages/workspaces/denali/src/list/tour-list-projection.ts`

---

## Literal insertion block (scaffold)

```typescript
// docs/phase-9/appendices/tours-operator-api-dispatch-addendum.md v2
export const TOURS_OPERATOR_DISPATCH = [
  { operationId: "listTours", method: "GET", path: "/tours", handler: "tours/list.handler" },
  { operationId: "getTour", method: "GET", path: "/tours/{id}", handler: "tours/get.handler" },
  {
    operationId: "patchTour",
    method: "PATCH",
    path: "/tours/{id}",
    handler: "tours/patch.handler",
  },
] as const;
```

---

## Optional BFF proxy (if browser CORS requires)

| Route                             | Proxies to                     |
| --------------------------------- | ------------------------------ |
| `apps/web/app/api/tours/route.ts` | `GET /tours?view=operator&...` |

Only add when direct API fetch fails in 9.3-L-R2 integration — not default.

---

## Forbidden dispatch (P9-F-004)

- No `GET /app/tours/new` or `(app)/tours/new` web route duplication
- No Nest `legacy/apps/api/src/modules/tours` tree port
- No full `canonical` in operator list items

---

## Test harness notes (9.3 · memory driver)

| Concern | Trunk behavior |
| ------- | -------------- |
| Smoke tenant `00000000-0000-4000-8000-000000000014` | **`denali`** in `DEV_TENANTS` (DEC-P11-001 / Phase 11.0) — same as web `createTourAction` |
| `DATABASE_URL` in shell | Cleared by `bootstrap-outbox-test-env.ts` when `STORAGE_DRIVER=memory` so Postgres tenant rows cannot override registry resolution |
| POST `/tours` body in `tours-operator.spec.ts` | Starter-shaped ingress (`basics.title`, `details.summary`, optional `category`) — **not** persisted as starter roots |
| Denali starter bridge (until 11.7) | Tenant `…0014` + starter ingress with **both** `basics.title` and `details.summary`: validate with **starter** plugin, then `enrichStarterDocumentForDenaliOperatorList` adds flat `title` + `program.shortDescription` for Denali operator list projection |
| Partial starter ingress (e.g. title-only on tenant `…000003`) | Bridge normalizes paths but **does not** apply operator defaults → **400** `VALIDATION_FAILURE` (see `denali-wizard.spec.ts` SMK-P6-05) |
| Validation engine | `getOrCreateValidationEngine` omits `plugin.tourList`, `plugin.tourClone`, and `plugin.publicCatalog` before `PlatformWizardEngine.create` (callable operator/marketing surfaces are not wizard ingress) |
| Fast API proof | `pnpm --filter @apps/api run test:file test/tours-operator.spec.ts test/denali-operator-create-bridge.spec.ts` |
