import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { isPersistedTenantUuid } from "./tenant-id-format";
import { findTenantById } from "./tenant-registry";
import { invalidateTenantRegistryCache, setCachedTenantThemeById } from "./tenant-registry-cache";

/**
 * Admin `tenants` update with registry cache invalidation (DEC-074 / PU-F-01).
 * Test/dev without Postgres persists theme JSON to the in-process cache only.
 */
export async function updateTenantRegistryRow(
  tenantId: string,
  data: Prisma.TenantUpdateInput
): Promise<{ readonly id: string; readonly subdomain: string }> {
  const normalized = tenantId.trim().toLowerCase();
  if (!process.env.DATABASE_URL?.trim() || !isPersistedTenantUuid(normalized)) {
    if (data.theme !== undefined) {
      setCachedTenantThemeById(normalized, data.theme);
    }
    const devTenant = findTenantById(normalized);
    invalidateTenantRegistryCache(normalized, devTenant?.subdomain);
    return { id: normalized, subdomain: devTenant?.subdomain ?? normalized };
  }

  const admin = getPrismaAdmin();
  const row = await admin.tenant.update({
    where: { id: normalized },
    data,
    select: { id: true, subdomain: true },
  });
  invalidateTenantRegistryCache(row.id, row.subdomain);
  return row;
}
