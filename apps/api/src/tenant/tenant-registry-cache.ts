import type { RegisteredTenant } from "./tenant-registry";

type CacheEntry = {
  readonly tenant: RegisteredTenant | null;
  readonly expiresAt: number;
};

const CACHE_TTL_MS = 5_000;
const byId = new Map<string, CacheEntry>();
const bySubdomain = new Map<string, CacheEntry>();

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
  key: string,
  tenant: RegisteredTenant | null
): void {
  map.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** PERF-1 — short TTL read-through cache for Postgres tenant metadata (admin pool). */
export function getCachedTenantById(id: string): RegisteredTenant | null | undefined {
  return readEntry(byId, id);
}

export function setCachedTenantById(id: string, tenant: RegisteredTenant | null): void {
  writeEntry(byId, id, tenant);
}

export function getCachedTenantBySubdomain(subdomain: string): RegisteredTenant | null | undefined {
  return readEntry(bySubdomain, subdomain);
}

export function setCachedTenantBySubdomain(
  subdomain: string,
  tenant: RegisteredTenant | null
): void {
  writeEntry(bySubdomain, subdomain, tenant);
}

/** Test-only — reset between specs. */
export function resetTenantRegistryCacheForTests(): void {
  byId.clear();
  bySubdomain.clear();
}
