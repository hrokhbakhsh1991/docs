import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { invalidateTenantRegistryCache } from "./tenant-registry-cache";

/**
 * Admin `tenants` update with registry cache invalidation (DEC-074 / PU-F-01).
 */
export async function updateTenantRegistryRow(
  tenantId: string,
  data: Prisma.TenantUpdateInput
): Promise<{ readonly id: string; readonly subdomain: string }> {
  const admin = getPrismaAdmin();
  const row = await admin.tenant.update({
    where: { id: tenantId },
    data,
    select: { id: true, subdomain: true },
  });
  invalidateTenantRegistryCache(row.id, row.subdomain);
  return row;
}
