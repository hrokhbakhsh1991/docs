import { getActiveTenantId } from "../tenant/tenant-request-context";

export const TENANT_RLS_ALS_TENANT_MISMATCH = "TENANT_RLS_ALS_TENANT_MISMATCH";

/**
 * When ALS is bound, RLS session tenant must match (DEC-028 / P1-4).
 * No-op when ALS is unset (relay paths that only pass explicit tenantId).
 */
export function assertActiveTenantMatchesRlsTarget(rlsTenantId: string): void {
  const normalized = rlsTenantId.trim();
  const active = getActiveTenantId();
  if (active !== undefined && active !== normalized) {
    throw new Error(TENANT_RLS_ALS_TENANT_MISMATCH);
  }
}
