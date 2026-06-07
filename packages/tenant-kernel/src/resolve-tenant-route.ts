import type { TenantRoute, TenantTier } from "./route";
import type { TenantRouteRow } from "./tenant-route-row";

export const TENANT_ROUTE_MISCONFIGURED = "TENANT_ROUTE_MISCONFIGURED";

export type ResolveTenantRouteOptions = {
  readonly poolDatabaseUrl: string;
};

function assertPoolDatabaseUrl(poolDatabaseUrl: string): void {
  if (poolDatabaseUrl.trim().length === 0) {
    throw new Error("TENANT_ROUTE_POOL_DATABASE_URL_REQUIRED");
  }
}

function isTenantTier(value: string): value is TenantTier {
  return value === "pool" || value === "silo";
}

/**
 * Pure resolver — maps optional DB row + pool URL to {@link TenantRoute}.
 * @see docs/phase-7/appendices/TENANT-ROUTER-SPEC.md
 */
export function resolveTenantRoute(
  tenantId: string,
  row: TenantRouteRow | null,
  options: ResolveTenantRouteOptions
): TenantRoute {
  const normalizedTenantId = tenantId.trim();
  if (normalizedTenantId.length === 0) {
    throw new Error("TENANT_ROUTE_TENANT_ID_REQUIRED");
  }
  assertPoolDatabaseUrl(options.poolDatabaseUrl);

  if (row === null || row.tier === "pool") {
    return {
      tenantId: normalizedTenantId,
      tier: "pool",
      databaseUrl: options.poolDatabaseUrl,
      useRls: true,
    };
  }

  if (!isTenantTier(row.tier)) {
    throw new Error("TENANT_ROUTE_INVALID_TIER");
  }

  const hasDatabaseUrl = row.databaseUrl !== null && row.databaseUrl.trim().length > 0;
  const hasSchemaName = row.schemaName !== null && row.schemaName.trim().length > 0;

  if (!hasDatabaseUrl && !hasSchemaName) {
    throw new Error(TENANT_ROUTE_MISCONFIGURED);
  }

  return {
    tenantId: normalizedTenantId,
    tier: "silo",
    databaseUrl: hasDatabaseUrl ? row.databaseUrl!.trim() : options.poolDatabaseUrl,
    schemaName: hasSchemaName ? row.schemaName!.trim() : undefined,
    useRls: !hasDatabaseUrl,
  };
}
