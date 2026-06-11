contract_id: TOURS-PUBLISH-FIELD-GATE
version: "2026-06-07-v1"
subphase: "8.1"
route: PATCH /tours/{tourId}
workspaceType_gate: urban
surface: urban.tour.publish_fields
forbidden_bypass: admin|member publish via generic tours route
authority: docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md L354

## MODULES

| Symbol                               | Path                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `urbanTourPatchRequiresOwner`        | `packages/workspaces/urban/src/http/tour-publish-field-gate.ts`   |
| `assertWorkspaceOwner`               | `packages/workspaces/urban/src/http/require-workspace-owner.ts`   |
| `UrbanOwnerRequiredError`            | `packages/workspaces/urban/src/http/errors/urban-owner-required.error.ts` |
| `handlePatchTour`                    | `apps/api/src/tours/tours.routes.ts`                  |
| `UpdateTourBody`                     | `apps/api/src/tours/update-tour.schema.ts`            |

## PROTECTED PATH SET

```typescript
export const URBAN_TOUR_PUBLISH_PROTECTED_PATHS = [
  "publishStatus",
  "tour.status",
  "tour.publishedAt",
  "tour.publishStatus",
] as const;
```

## DETECTION FUNCTION

```typescript
import type { UpdateTourBody } from "../tours/update-tour.schema";

function pathSetIncludesProtectedPath(paths: readonly string[]): boolean {
  for (const path of paths) {
    if ((URBAN_TOUR_PUBLISH_PROTECTED_PATHS as readonly string[]).includes(path)) {
      return true;
    }
  }
  return false;
}

function dataObjectTouchesPublishFields(data: Record<string, unknown>): boolean {
  if ("publishStatus" in data) {
    return true;
  }
  const tour = data.tour;
  if (tour !== null && typeof tour === "object" && !Array.isArray(tour)) {
    const tourRecord = tour as Record<string, unknown>;
    if ("status" in tourRecord) return true;
    if ("publishedAt" in tourRecord) return true;
    if ("publishStatus" in tourRecord) return true;
  }
  return false;
}

export function urbanTourPatchTouchesPublishFields(body: UpdateTourBody): boolean {
  if (body.roots !== undefined && pathSetIncludesProtectedPath(body.roots)) {
    return true;
  }
  if (body.data !== undefined && dataObjectTouchesPublishFields(body.data)) {
    return true;
  }
  return false;
}
```

## INSERTION POINT

| File                                 | Function          | Anchor line (trunk)                                            | Insert after       |
| ------------------------------------ | ----------------- | -------------------------------------------------------------- | ------------------ |
| `apps/api/src/tours/tours.routes.ts` | `handlePatchTour` | L77 `const auth = await resolveTenantContextFromRequest(req);` | auth resolution    |
| `apps/api/src/tours/tours.routes.ts` | `handlePatchTour` | before L79 `await runWithHttpRequestContext(`                  | owner publish gate |

## BRANCH (frozen)

```typescript
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { assertWorkspaceOwner } from "../urban/require-workspace-owner";
import { urbanTourPatchTouchesPublishFields } from "../urban/urban-tour-publish-field-gate";

export async function handlePatchTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
  tourId: string
): Promise<void> {
  try {
    const { parsedBody } = await readTourRequestBody(req);
    const body = parseUpdateTourBody(parsedBody);
    const auth = await resolveTenantContextFromRequest(req);

    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    if (workspaceType === "urban" && urbanTourPatchTouchesPublishFields(body)) {
      assertWorkspaceOwner({
        auth,
        workspaceType,
        surface: "urban.tour.publish_fields",
      });
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await deps.toursService.updateTour(auth, tourId, body);
        sendJson(res, 200, {
          id: record.id,
          tenantId: record.tenantId,
          canonical: record.canonical,
          rowVersion: record.rowVersion,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
```

## DENY MATRIX

| actor_role | workspaceType | `urbanTourPatchTouchesPublishFields` | outcome                                                    |
| ---------- | ------------- | ------------------------------------ | ---------------------------------------------------------- |
| owner      | urban         | true                                 | `assertWorkspaceOwner` pass → `updateTour`                 |
| admin      | urban         | true                                 | `UrbanOwnerRequiredError` → **403** `URBAN_OWNER_REQUIRED` |
| member     | urban         | true                                 | `UrbanOwnerRequiredError` → **403** `URBAN_OWNER_REQUIRED` |
| admin      | urban         | false                                | generic `canUpdateCanonicalDocument` path — no owner gate  |
| owner      | starter       | true                                 | no urban branch — existing tours auth only                 |
| owner      | urban         | false                                | no owner gate — draft field patch allowed                  |

## HTTP ERROR CONTRACT

```json
{
  "error": "URBAN_OWNER_REQUIRED",
  "code": "URBAN_OWNER_REQUIRED",
  "correlationId": "<requestId>"
}
```

| Field   | Value                                                  |
| ------- | ------------------------------------------------------ |
| Status  | `403`                                                  |
| Header  | `x-correlation-id: <requestId>`                        |
| Emitter | `handleHttpError` · `isUrbanOwnerRequiredError` branch |

## TEST CONTRACT

| Case ID    | actor  | body.data                           | Expected                       |
| ---------- | ------ | ----------------------------------- | ------------------------------ |
| TPG-8.1-01 | admin  | `{ tour: { status: "published" } }` | **403** `URBAN_OWNER_REQUIRED` |
| TPG-8.1-02 | member | `{ publishStatus: "published" }`    | **403** `URBAN_OWNER_REQUIRED` |
| TPG-8.1-03 | owner  | `{ tour: { status: "published" } }` | **200**                        |
| TPG-8.1-04 | admin  | `{ tour: { title: "x" } }`          | **200** (no publish fields)    |
| TPG-8.1-05 | owner  | `{ tour: { title: "x" } }`          | **200**                        |

**File:** `apps/api/test/urban-tour-publish-field-gate.spec.ts`

## FORBIDDEN

```text
FORBIDDEN isAdminOrOwner check in handlePatchTour for urban publish fields
FORBIDDEN role === "owner" string gate in tours.routes.ts
FORBIDDEN skip assertWorkspaceOwner when workspaceType=urban and urbanTourPatchTouchesPublishFields(body)=true
FORBIDDEN persist publish field mutation when assertWorkspaceOwner throws
```
