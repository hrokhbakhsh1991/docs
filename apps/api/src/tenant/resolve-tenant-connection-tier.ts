/**
 * Connection tier for rate limits + observability (DEC-P7-004 / DEC-P7-006).
 * 7.7 TenantConnectionRouter replaces this stub.
 */
export type TenantConnectionTier = "pool" | "silo";

export function resolveTenantConnectionTier(_tenantId?: string): TenantConnectionTier {
  return "pool";
}
