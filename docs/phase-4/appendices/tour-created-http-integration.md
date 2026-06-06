# Phase 4.5 — TourCreated HTTP integration proof

```yaml
subphase: "4.5"
enforcement: P4-E-EVT-01
test_matrix: EVT-1
spec: ../subphases/4.5-platform-events.md
```

## Purpose

Prove **integration** path: HTTP `POST /tours` → `ToursService` → in-process `TourCreated` on `@app-tour/platform-events` with matching `tenantId`.

Unit coverage in `canonical-tour.service.events.spec.ts` does not replace this — subphase 4.5 requires HTTP ingress.

## Spec

| File                                                    | Layer                 |
| ------------------------------------------------------- | --------------------- |
| `apps/api/test/4-integration/tour-created-http.spec.ts` | HTTP + memory storage |

## Run

```bash
cd apps/api
NODE_ENV=test STORAGE_DRIVER=memory \
  node --import tsx --test --test-concurrency=1 --test-force-exit \
  test/4-integration/tour-created-http.spec.ts
```

## Pass criteria

- `POST /tours` returns **201**
- Exactly one `TourCreated` on bus with `tenantId` matching auth headers
- No outbox row when `STORAGE_DRIVER=memory` (in-process publish path)

## Related

- Package unit: `packages/platform-events/test/*.spec.ts`
- Service unit: `apps/api/src/canonical/canonical-tour.service.events.spec.ts`
