import { performance } from "node:perf_hooks";

import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import {
  recordAdminPoolRead,
  recordTenantRegistryCacheHit,
  recordTenantRegistryCacheMiss,
} from "./admin-pool-read-monitor";
import {
  findTenantById,
  findTenantBySubdomain,
  isStaticTenantRegistryAllowed,
  type RegisteredTenant,
} from "./tenant-registry";
import {
  getCachedTenantById,
  getCachedTenantBySubdomain,
  getCachedTenantThemeById,
  setCachedTenantById,
  setCachedTenantBySubdomain,
  setCachedTenantThemeById,
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
      recordTenantRegistryCacheHit("by_id");
      return cached;
    }
    recordTenantRegistryCacheMiss("by_id");
    const readStarted = performance.now();
    const row = await getPrismaAdmin().tenant.findUnique({
      where: { id: normalized },
    });
    recordAdminPoolRead(performance.now() - readStarted);
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
      recordTenantRegistryCacheHit("by_subdomain");
      return cached;
    }
    recordTenantRegistryCacheMiss("by_subdomain");
    const readStarted = performance.now();
    const row = await getPrismaAdmin().tenant.findUnique({
      where: { subdomain: normalized },
    });
    recordAdminPoolRead(performance.now() - readStarted);
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

let adminThemeLookupCountForTests = 0;

/** Test-only — count admin `findUnique` for theme resolution. */
export function getAdminThemeLookupCountForTests(): number {
  return adminThemeLookupCountForTests;
}

/** Test-only — reset admin theme lookup counter. */
export function resetAdminThemeLookupCountForTests(): void {
  adminThemeLookupCountForTests = 0;
}

/**
 * Raw `tenants.theme` JSON with 5s read-through cache (DEC-053 / RL-DOS-01).
 * Negative-caches unknown UUIDs to stop rotating-ID admin storms.
 */
export async function resolveTenantThemeJsonById(tenantId: string): Promise<unknown | null> {
  const normalized = tenantId.trim().toLowerCase();

  const cachedTheme = getCachedTenantThemeById(normalized);
  if (cachedTheme !== undefined) {
    recordTenantRegistryCacheHit("theme");
    return cachedTheme;
  }

  if (process.env.DATABASE_URL?.trim() && isPersistedTenantUuid(normalized)) {
    recordTenantRegistryCacheMiss("theme");
    adminThemeLookupCountForTests += 1;
    const readStarted = performance.now();
    const row = await getPrismaAdmin().tenant.findUnique({
      where: { id: normalized },
      select: { theme: true },
    });
    recordAdminPoolRead(performance.now() - readStarted);
    const theme = row !== null ? row.theme : null;
    setCachedTenantThemeById(normalized, theme);
    return theme;
  }

  if (isStaticTenantRegistryAllowed()) {
    return findTenantById(normalized)?.theme ?? null;
  }

  return null;
}
