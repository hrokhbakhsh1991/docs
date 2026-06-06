import type { RegisteredTenant } from "./tenant-registry";
import { metricsRegistry } from "../observability/metrics";
import { invalidateTenantConfigResponseCache } from "./tenant-config-response-cache";

type CacheEntry = {
  readonly tenant: RegisteredTenant | null;
  readonly expiresAt: number;
};

type ThemeCacheEntry = {
  readonly theme: unknown | null;
  readonly expiresAt: number;
};

const CACHE_TTL_MS = 5_000;
const DEFAULT_MAX_ENTRIES = 1024;

const byId = new Map<string, CacheEntry>();
const bySubdomain = new Map<string, CacheEntry>();
const themeById = new Map<string, ThemeCacheEntry>();

const byIdOrder: string[] = [];
const bySubdomainOrder: string[] = [];
const themeByIdOrder: string[] = [];

export function resolveTenantRegistryCacheMaxEntries(): number {
  const raw = process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES?.trim();
  if (!raw) {
    return DEFAULT_MAX_ENTRIES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_ENTRIES;
}

function touchOrder(order: string[], key: string): void {
  const index = order.indexOf(key);
  if (index >= 0) {
    order.splice(index, 1);
  }
  order.push(key);
}

function purgeExpiredTenantEntries(map: Map<string, CacheEntry>, order: string[]): void {
  const now = Date.now();
  for (const key of [...order]) {
    const entry = map.get(key);
    if (entry === undefined || now >= entry.expiresAt) {
      map.delete(key);
      const index = order.indexOf(key);
      if (index >= 0) {
        order.splice(index, 1);
      }
    }
  }
}

function purgeExpiredThemeEntries(map: Map<string, ThemeCacheEntry>, order: string[]): void {
  const now = Date.now();
  for (const key of [...order]) {
    const entry = map.get(key);
    if (entry === undefined || now >= entry.expiresAt) {
      map.delete(key);
      const index = order.indexOf(key);
      if (index >= 0) {
        order.splice(index, 1);
      }
    }
  }
}

function enforceTenantMapBounds(map: Map<string, CacheEntry>, order: string[]): void {
  purgeExpiredTenantEntries(map, order);
  const maxEntries = resolveTenantRegistryCacheMaxEntries();
  while (order.length > maxEntries) {
    const evictKey = order.shift();
    if (evictKey === undefined) {
      break;
    }
    map.delete(evictKey);
  }
}

function enforceThemeMapBounds(map: Map<string, ThemeCacheEntry>, order: string[]): void {
  purgeExpiredThemeEntries(map, order);
  const maxEntries = resolveTenantRegistryCacheMaxEntries();
  while (order.length > maxEntries) {
    const evictKey = order.shift();
    if (evictKey === undefined) {
      break;
    }
    map.delete(evictKey);
  }
}

function readEntry(map: Map<string, CacheEntry>, key: string): RegisteredTenant | null | undefined {
  const entry = map.get(key);
  if (entry === undefined) {
    return undefined;
  }
  if (Date.now() >= entry.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return entry.tenant;
}

function writeEntry(
  map: Map<string, CacheEntry>,
  order: string[],
  key: string,
  tenant: RegisteredTenant | null
): void {
  map.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  touchOrder(order, key);
  enforceTenantMapBounds(map, order);
}

/** PERF-1 — short TTL read-through cache for Postgres tenant metadata (admin pool). */
export function getCachedTenantById(id: string): RegisteredTenant | null | undefined {
  return readEntry(byId, id);
}

export function setCachedTenantById(id: string, tenant: RegisteredTenant | null): void {
  writeEntry(byId, byIdOrder, id, tenant);
}

export function getCachedTenantBySubdomain(subdomain: string): RegisteredTenant | null | undefined {
  return readEntry(bySubdomain, subdomain);
}

export function setCachedTenantBySubdomain(
  subdomain: string,
  tenant: RegisteredTenant | null
): void {
  writeEntry(bySubdomain, bySubdomainOrder, subdomain, tenant);
}

function readThemeEntry(id: string): unknown | null | undefined {
  const entry = themeById.get(id);
  if (entry === undefined) {
    return undefined;
  }
  if (Date.now() >= entry.expiresAt) {
    themeById.delete(id);
    return undefined;
  }
  return entry.theme;
}

/** RL-DOS-01/03 — short TTL cache for raw `tenants.theme` JSON (rate limit + internal reads). */
export function getCachedTenantThemeById(id: string): unknown | null | undefined {
  return readThemeEntry(id);
}

export function setCachedTenantThemeById(id: string, theme: unknown | null): void {
  themeById.set(id, { theme, expiresAt: Date.now() + CACHE_TTL_MS });
  touchOrder(themeByIdOrder, id);
  enforceThemeMapBounds(themeById, themeByIdOrder);
}

/** Test-only — sizes per map. */
export function readTenantRegistryCacheSizesForTests(): {
  readonly byId: number;
  readonly bySubdomain: number;
  readonly themeById: number;
} {
  return {
    byId: byId.size,
    bySubdomain: bySubdomain.size,
    themeById: themeById.size,
  };
}

function removeKeyFromOrder(order: string[], key: string): void {
  const index = order.indexOf(key);
  if (index >= 0) {
    order.splice(index, 1);
  }
}

/**
 * Evicts cached tenant metadata after admin write (DEC-074 / PU-F-01).
 * Pass `subdomain` when known so `bySubdomain` is cleared (PU-F-04).
 */
export function invalidateTenantRegistryCache(tenantId: string, subdomain?: string): void {
  const normalizedId = tenantId.trim();
  if (normalizedId.length === 0) {
    return;
  }

  if (byId.delete(normalizedId)) {
    removeKeyFromOrder(byIdOrder, normalizedId);
  }
  if (themeById.delete(normalizedId)) {
    removeKeyFromOrder(themeByIdOrder, normalizedId);
  }
  invalidateTenantConfigResponseCache(normalizedId);

  const normalizedSubdomain = subdomain?.trim().toLowerCase();
  if (normalizedSubdomain !== undefined && normalizedSubdomain.length > 0) {
    if (bySubdomain.delete(normalizedSubdomain)) {
      removeKeyFromOrder(bySubdomainOrder, normalizedSubdomain);
    }
  }

  metricsRegistry.increment("tenant_registry_cache_invalidated_total");
}

/** Test-only — reset between specs. */
export function resetTenantRegistryCacheForTests(): void {
  byId.clear();
  bySubdomain.clear();
  themeById.clear();
  byIdOrder.length = 0;
  bySubdomainOrder.length = 0;
  themeByIdOrder.length = 0;
}
