import { performance } from "node:perf_hooks";

import { resolveEffectiveTenantBranding, type TenantThemeConfig } from "@app-tour/workspace-sdk";

import { resolveDefaultTenantBranding } from "./workspace-default-tenant-branding";

import { getPrismaAdmin } from "../db/prisma";
import {
  recordAdminPoolRead,
  recordTenantRegistryCacheHit,
  recordTenantRegistryCacheMiss,
} from "./admin-pool-read-monitor";
import {
  canResolveDevTenantRegistryFallback,
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
  const displayName = typeof record.displayName === "string" ? record.displayName : undefined;
  const defaultLocale =
    record.defaultLocale === "en" || record.defaultLocale === "fa"
      ? record.defaultLocale
      : undefined;
  const logoRaw = record.logo;
  const logo =
    logoRaw !== null &&
    typeof logoRaw === "object" &&
    typeof (logoRaw as Record<string, unknown>).storageKey === "string"
      ? {
          storageKey: String((logoRaw as Record<string, unknown>).storageKey),
          ...(typeof (logoRaw as Record<string, unknown>).contentType === "string"
            ? { contentType: String((logoRaw as Record<string, unknown>).contentType) }
            : {}),
        }
      : undefined;
  return {
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(cssVariables !== undefined ? { cssVariables } : {}),
    ...(displayName !== undefined ? { displayName } : {}),
    ...(defaultLocale !== undefined ? { defaultLocale } : {}),
    ...(logo !== undefined ? { logo } : {}),
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
    theme: resolveEffectiveTenantBranding(
      themeFromJson(row.theme),
      resolveDefaultTenantBranding(row.workspaceType)
    ),
  };
}

/**
 * Resolves tenant metadata — Postgres `tenants` row when `DATABASE_URL` is set,
 * else static `DEV_TENANTS` when {@link isStaticTenantRegistryAllowed} or dev smoke fallback applies.
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
    if (row !== null) {
      const mapped = mapPrismaTenant(row);
      setCachedTenantById(normalized, mapped);
      return mapped;
    }
  }
  if (isStaticTenantRegistryAllowed() || canResolveDevTenantRegistryFallback()) {
    const devTenant = findTenantById(normalized);
    if (devTenant !== null) {
      setCachedTenantById(normalized, devTenant);
      return devTenant;
    }
  }
  if (process.env.DATABASE_URL?.trim() && isPersistedTenantUuid(normalized)) {
    setCachedTenantById(normalized, null);
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
    if (row !== null) {
      const mapped = mapPrismaTenant(row);
      setCachedTenantBySubdomain(normalized, mapped);
      return mapped;
    }
  }
  if (isStaticTenantRegistryAllowed() || canResolveDevTenantRegistryFallback()) {
    const devTenant = findTenantBySubdomain(normalized);
    if (devTenant !== null) {
      setCachedTenantBySubdomain(normalized, devTenant);
      return devTenant;
    }
  }
  if (process.env.DATABASE_URL?.trim()) {
    setCachedTenantBySubdomain(normalized, null);
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

  if (canResolveDevTenantRegistryFallback()) {
    return findTenantById(normalized)?.theme ?? null;
  }

  return null;
}
