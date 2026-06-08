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
  // Phase 8.2 — public catalog + registration intake
  {
    method: "GET",
    path: "/urban/catalog",
    summary: "List published urban catalog tours (anonymous)",
    operationId: "getUrbanCatalog",
  },
  {
    method: "GET",
    path: "/urban/catalog/{tourId}",
    summary: "Get published urban catalog tour detail (anonymous)",
    operationId: "getUrbanCatalogTour",
  },
  {
    method: "POST",
    path: "/urban/registrations",
    summary: "Public urban registration intake (anonymous)",
    operationId: "postUrbanRegistration",
  },
] as const;
