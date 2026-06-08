import { getTenantConnectionRouter } from "./tenant-connection-router";

/**
 * Resolves the active database URL for a tenant via {@link TenantConnectionRouter} (RULE-P8-006).
 * Pool default when no silo row; dedicated URL when tier=silo with database_url set.
 */
export async function resolveTenantDatabaseUrl(tenantId: string): Promise<string> {
  const route = await getTenantConnectionRouter().resolveRoute(tenantId);
  return route.databaseUrl;
}
