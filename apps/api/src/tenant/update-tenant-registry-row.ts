import type { Prisma } from "@prisma/client";

import { isPersistedTenantUuid } from "./tenant-id-format";
import { findTenantById, isStaticTenantRegistryAllowed } from "./tenant-registry";
import { invalidateTenantRegistryCache, setCachedTenantThemeById } from "./tenant-registry-cache";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantIdSubdomainById,
  updateTenantRow,
} from "./tenant-registry-admin.port";

/**
 * Admin `tenants` update with registry cache invalidation (DEC-074 / PU-F-01).
 * Test/dev without Postgres persists theme JSON to the in-process cache only.
 * Postgres I/O goes through {@link updateTenantRow} / {@link findTenantIdSubdomainById} (PSR-5c).
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
      if (data.theme !== undefined) {
        setCachedTenantThemeById(normalized, data.theme);
      }
      return { id: normalized, subdomain: devTenant?.subdomain ?? normalized };
    }
    throw new Error(`updateTenantRegistryRow: DATABASE_URL required for tenant ${normalized}`);
  }

  const existing = await findTenantIdSubdomainById(
    normalized,
    TENANT_REGISTRY_ADMIN_REASON.REGISTRY_UPDATE
  );

  if (existing === null) {
    if (isStaticTenantRegistryAllowed()) {
      const devTenant = findTenantById(normalized);
      if (devTenant !== null) {
        if (data.theme !== undefined) {
          setCachedTenantThemeById(normalized, data.theme);
        }
        invalidateTenantRegistryCache(normalized, devTenant.subdomain);
        if (data.theme !== undefined) {
          setCachedTenantThemeById(normalized, data.theme);
        }
        return { id: normalized, subdomain: devTenant.subdomain };
      }
    }
    throw new Error("TENANT_NOT_FOUND");
  }

  const row = await updateTenantRow(
    normalized,
    data,
    TENANT_REGISTRY_ADMIN_REASON.REGISTRY_UPDATE
  );
  invalidateTenantRegistryCache(row.id, row.subdomain);
  return row;
}
