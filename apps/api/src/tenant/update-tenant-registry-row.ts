import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { isPersistedTenantUuid } from "./tenant-id-format";
import { findTenantById, isStaticTenantRegistryAllowed } from "./tenant-registry";
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
    if (isStaticTenantRegistryAllowed()) {
      const devTenant = findTenantById(normalized);
      invalidateTenantRegistryCache(normalized, devTenant?.subdomain);
      return { id: normalized, subdomain: devTenant?.subdomain ?? normalized };
    }
    throw new Error(`updateTenantRegistryRow: DATABASE_URL required for tenant ${normalized}`);
  }

  const admin = getPrismaAdmin();
  const existing = await admin.tenant.findUnique({
    where: { id: normalized },
    select: { id: true, subdomain: true },
  });

  if (existing === null) {
    if (isStaticTenantRegistryAllowed()) {
      const devTenant = findTenantById(normalized);
      if (devTenant !== null) {
        if (data.theme !== undefined) {
          setCachedTenantThemeById(normalized, data.theme);
        }
        invalidateTenantRegistryCache(normalized, devTenant.subdomain);
        return { id: normalized, subdomain: devTenant.subdomain };
      }
    }
    throw new Error("TENANT_NOT_FOUND");
  }

  const row = await admin.tenant.update({
    where: { id: normalized },
    data,
    select: { id: true, subdomain: true },
  });
  invalidateTenantRegistryCache(row.id, row.subdomain);
  return row;
}
