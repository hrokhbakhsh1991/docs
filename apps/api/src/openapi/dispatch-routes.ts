/**
 * HTTP route inventory — single SoT for OpenAPI generation and shadow-API guards (DEC-099).
 * @see docs/phase-5/appendices/openapi-dispatch-contract.md
 */
export type DispatchRoute = {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly path: string;
  readonly summary: string;
  readonly internal?: boolean;
  readonly operationId: string;
};

export const DISPATCH_ROUTES: readonly DispatchRoute[] = [
  {
    method: "GET",
    path: "/health",
    summary: "Liveness probe",
    operationId: "getHealth",
  },
  {
    method: "GET",
    path: "/internal/metrics",
    summary: "Prometheus metrics (dev/test)",
    internal: true,
    operationId: "getInternalMetrics",
  },
  {
    method: "POST",
    path: "/internal/cache/invalidate",
    summary: "Invalidate registry cache / flush Redis rate keys",
    internal: true,
    operationId: "invalidateCache",
  },
  {
    method: "GET",
    path: "/api/v2/tenant-config",
    summary: "Tenant theme and feature flags",
    operationId: "getTenantConfig",
  },
  {
    method: "GET",
    path: "/api/v2/map/enrich",
    summary: "Map upstream enrich proxy",
    operationId: "getMapEnrich",
  },
  {
    method: "POST",
    path: "/internal/tenants/provision",
    summary: "Provision tenant (dev/test only)",
    internal: true,
    operationId: "provisionTenant",
  },
  {
    method: "GET",
    path: "/internal/test/db-pool-hold",
    summary: "Test-only pool hold hook",
    internal: true,
    operationId: "dbPoolHold",
  },
  {
    method: "POST",
    path: "/internal/outbox/{outboxId}/replay",
    summary: "Replay failed outbox row",
    internal: true,
    operationId: "replayOutbox",
  },
  {
    method: "POST",
    path: "/tours",
    summary: "Create tour",
    operationId: "createTour",
  },
  {
    method: "GET",
    path: "/tours",
    summary: "List tours for tenant (cursor pagination)",
    operationId: "listTours",
  },
  {
    method: "GET",
    path: "/tours/{tourId}",
    summary: "Get tour by id",
    operationId: "getTour",
  },
  {
    method: "PATCH",
    path: "/tours/{tourId}",
    summary: "Patch tour (optimistic lock)",
    operationId: "patchTour",
  },
] as const;
