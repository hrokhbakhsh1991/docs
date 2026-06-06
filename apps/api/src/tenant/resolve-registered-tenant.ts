import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import {
  findTenantById,
  findTenantBySubdomain,
  isStaticTenantRegistryAllowed,
  type RegisteredTenant,
} from "./tenant-registry";
import {
  getCachedTenantById,
  getCachedTenantBySubdomain,
  setCachedTenantById,
  setCachedTenantBySubdomain,
} from "./tenant-registry-cache";
import { isPersistedTenantUuid } from "./tenant-id-format";

function themeFromJson(theme: unknown): TenantThemeConfig {
  if (theme === null || typeof theme !== "object") {
    return {};
  }
  const record = theme as Record<string, unknown>;
  const primaryColor = typeof record.primaryColor === "string" ? record.primaryColor : undefined;
  const cssVariables =
    record.cssVariables !== null && typeof record.cssVariables === "object"
      ? (record.cssVariables as Record<string, string>)
      : undefined;
  return {
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(cssVariables !== undefined ? { cssVariables } : {}),
  };
}

function mapPrismaTenant(row: {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly theme: unknown;
}): RegisteredTenant {
  return {
    id: row.id,
    subdomain: row.subdomain,
    workspaceType: row.workspaceType,
    theme: themeFromJson(row.theme),
  };
}

/**
 * Resolves tenant metadata — Postgres `tenants` row when `DATABASE_URL` is set,
 * else static `DEV_TENANTS` registry when {@link isStaticTenantRegistryAllowed}.
 */
export async function resolveRegisteredTenantById(
  tenantId: string
): Promise<RegisteredTenant | null> {
  const normalized = tenantId.trim().toLowerCase();
  if (process.env.DATABASE_URL?.trim() && isPersistedTenantUuid(normalized)) {
    const cached = getCachedTenantById(normalized);
    if (cached !== undefined) {
      return cached;
    }
    const row = await getPrismaAdmin().tenant.findUnique({
      where: { id: normalized },
    });
    const mapped = row !== null ? mapPrismaTenant(row) : null;
    setCachedTenantById(normalized, mapped);
    if (mapped !== null) {
      return mapped;
    }
  }
  if (isStaticTenantRegistryAllowed()) {
    return findTenantById(normalized);
  }
  return null;
}

export async function resolveRegisteredTenantBySubdomain(
  subdomain: string
): Promise<RegisteredTenant | null> {
  const normalized = subdomain.trim().toLowerCase();
  if (process.env.DATABASE_URL?.trim()) {
    const cached = getCachedTenantBySubdomain(normalized);
    if (cached !== undefined) {
      return cached;
    }
    const row = await getPrismaAdmin().tenant.findUnique({
      where: { subdomain: normalized },
    });
    const mapped = row !== null ? mapPrismaTenant(row) : null;
    setCachedTenantBySubdomain(normalized, mapped);
    if (mapped !== null) {
      return mapped;
    }
  }
  if (isStaticTenantRegistryAllowed()) {
    return findTenantBySubdomain(normalized);
  }
  return null;
}
