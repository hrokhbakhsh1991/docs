import { TenantConnectionRouter } from "@app-tour/tenant-kernel";

import { lookupTenantRouteRow } from "./tenant-route-lookup";

let sharedRouter: TenantConnectionRouter | undefined;

function resolvePoolDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url === undefined || url.length === 0) {
    return "postgresql://pool-unset:5432/app";
  }
  return url;
}

export function getTenantConnectionRouter(): TenantConnectionRouter {
  if (sharedRouter === undefined) {
    sharedRouter = new TenantConnectionRouter(lookupTenantRouteRow, resolvePoolDatabaseUrl());
  }
  return sharedRouter;
}

/** Test-only — reset singleton between node:test files. */
export function resetTenantConnectionRouterForTests(): void {
  sharedRouter = undefined;
}
