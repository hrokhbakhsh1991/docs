import type { TenantTier } from "@app-tour/tenant-kernel";

import { getActiveTenantTier } from "./tenant-request-context";

export type TenantConnectionTier = TenantTier;

/** Active connection tier from ALS — defaults to pool outside tenant-bound HTTP. */
export function resolveTenantConnectionTier(_tenantId?: string): TenantConnectionTier {
  return getActiveTenantTier() ?? "pool";
}
