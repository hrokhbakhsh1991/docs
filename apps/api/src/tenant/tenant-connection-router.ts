import { TenantConnectionRouter } from "@app-tour/tenant-kernel";

import { lookupTenantRouteRow } from "./tenant-route-lookup";

let defaultRouter: TenantConnectionRouter | undefined;
let testRouterOverride: TenantConnectionRouter | undefined;

function resolvePoolDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url === undefined || url.length === 0) {
    return "postgresql://pool-unset:5432/app";
  }
  return url;
}

export function getTenantConnectionRouter(): TenantConnectionRouter {
  if (testRouterOverride !== undefined) {
    return testRouterOverride;
  }
  if (defaultRouter === undefined) {
    defaultRouter = new TenantConnectionRouter(lookupTenantRouteRow, resolvePoolDatabaseUrl());
  }
  return defaultRouter;
}

/** Test-only — inject router with deterministic tenant_routes lookup. */
export function installTenantConnectionRouterForTests(router: TenantConnectionRouter): void {
  testRouterOverride = router;
}

/** Test-only — reset singleton between node:test files. */
export function resetTenantConnectionRouterForTests(): void {
  defaultRouter = undefined;
  testRouterOverride = undefined;
}
