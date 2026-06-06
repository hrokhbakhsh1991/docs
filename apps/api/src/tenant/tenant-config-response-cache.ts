/**
 * Short TTL cache of pre-serialized tenant-config JSON (DEC-129 / event-loop P2 #5).
 * @see docs/phase-5/appendices/http-response-size-budget.md
 */
const DEFAULT_TTL_MS = 5_000;

type CacheEntry = {
  readonly payload: string;
  readonly expiresAt: number;
};

const byTenantId = new Map<string, CacheEntry>();

function resolveTenantConfigResponseCacheTtlMs(): number {
  const raw = process.env.TENANT_CONFIG_RESPONSE_CACHE_TTL_MS?.trim();
  if (!raw) {
    return DEFAULT_TTL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TTL_MS;
  }
  return parsed;
}

export function getCachedTenantConfigPayload(tenantId: string): string | undefined {
  const normalized = tenantId.trim().toLowerCase();
  const entry = byTenantId.get(normalized);
  if (entry === undefined) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    byTenantId.delete(normalized);
    return undefined;
  }
  return entry.payload;
}

export function setCachedTenantConfigPayload(tenantId: string, payload: string): void {
  const normalized = tenantId.trim().toLowerCase();
  if (normalized.length === 0) {
    return;
  }
  byTenantId.set(normalized, {
    payload,
    expiresAt: Date.now() + resolveTenantConfigResponseCacheTtlMs(),
  });
}

export function invalidateTenantConfigResponseCache(tenantId: string): void {
  const normalized = tenantId.trim().toLowerCase();
  if (normalized.length === 0) {
    return;
  }
  byTenantId.delete(normalized);
}

/** Test-only — reset between specs. */
export function resetTenantConfigResponseCacheForTests(): void {
  byTenantId.clear();
}
