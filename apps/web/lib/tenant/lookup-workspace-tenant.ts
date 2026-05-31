import {
  buildTenantHostHeader,
  buildTenantSubdomainOrigin,
  resolveTenantRootDomain,
} from "@/lib/tenant/runtime-tenant-context";
import { evaluateWorkspaceHost } from "@/lib/tenant/workspace-host-policy";

export type WorkspaceTenantMetadata = {
  tenantId: string;
  slug: string;
};

type GlobalWithLookupCacheSweepTimer = typeof globalThis & {
  __lookupCacheSweepTimer?: NodeJS.Timeout;
};

const globalSweep = globalThis as GlobalWithLookupCacheSweepTimer;

const lookupCache = new Map<string, { data: WorkspaceTenantMetadata | null; expiresAt: number }>();
const LOOKUP_CACHE_MAX_ENTRIES = 5000;
const LOOKUP_CACHE_SWEEP_MS = 5 * 60 * 1000;

function pruneExpiredLookupCacheEntries(): void {
  const now = Date.now();
  for (const [key, item] of lookupCache) {
    if (now > item.expiresAt) {
      lookupCache.delete(key);
    }
  }
}

function writeLookupCacheEntry(
  cacheKey: string,
  data: WorkspaceTenantMetadata | null,
  expiresAt: number,
): void {
  if (!lookupCache.has(cacheKey) && lookupCache.size >= LOOKUP_CACHE_MAX_ENTRIES) {
    const oldestKey = lookupCache.keys().next().value;
    if (oldestKey !== undefined) {
      lookupCache.delete(oldestKey);
    }
  }
  lookupCache.set(cacheKey, { data, expiresAt });
}

if (typeof setInterval === "function") {
  if (globalSweep.__lookupCacheSweepTimer) {
    clearInterval(globalSweep.__lookupCacheSweepTimer);
  }
  globalSweep.__lookupCacheSweepTimer = setInterval(() => {
    pruneExpiredLookupCacheEntries();
  }, LOOKUP_CACHE_SWEEP_MS);
  if (globalSweep.__lookupCacheSweepTimer.unref) {
    globalSweep.__lookupCacheSweepTimer.unref();
  }
}

/** @internal Clears in-memory lookup cache (unit tests only). */
export function resetWorkspaceLookupCacheForTests(): void {
  lookupCache.clear();
}

function cacheTtlMs(): number {
  const parsed = Number(process.env.WORKSPACE_LOOKUP_CACHE_TTL_MS ?? "60000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function failOpenWhenApiUnreachable(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Edge middleware cannot resolve *.localhost; probe API on tenant subdomain (not 127.0.0.1). */
function resolveWorkspaceLookupProbeOrigin(tenantSlug: string): string {
  const override = process.env.WORKSPACE_LOOKUP_PROBE_ORIGIN?.trim();
  if (override) {
    return override.replace(/\/$/, "");
  }
  const slug = tenantSlug.trim().toLowerCase();
  const origin = buildTenantSubdomainOrigin(slug);
  const root = resolveTenantRootDomain();
  if (root === "localhost") {
    const port = process.env.NEXT_PUBLIC_API_PORT?.trim() || "3001";
    // Node fetch to 127.0.0.1 overwrites a custom Host header; subdomain URL preserves tenant Host.
    return `http://${slug}.${root}:${port}`;
  }
  return origin;
}

/** Legacy wrapper for compatibility. */
export async function lookupWorkspaceTenantExists(slug: string): Promise<boolean> {
  const meta = await lookupWorkspaceTenantMetadata(slug);
  return !!meta;
}

/** Probe tenant existence via auth Host resolution (matches API TENANT_HOST_UNKNOWN). */
export async function lookupWorkspaceTenantMetadata(
  slug: string,
): Promise<WorkspaceTenantMetadata | null> {
  const normalized = slug.trim().toLowerCase();
  const root = resolveTenantRootDomain();
  const cacheKey = `${root}:${normalized}`;
  const now = Date.now();
  const cached = lookupCache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.data;
    }
    lookupCache.delete(cacheKey);
  }

  const hostCheck = evaluateWorkspaceHost(`${normalized}.${root}`);
  if (!hostCheck.ok) {
    writeLookupCacheEntry(cacheKey, null, now + cacheTtlMs());
    return null;
  }

  const probeOrigin = resolveWorkspaceLookupProbeOrigin(normalized);
  const host = buildTenantHostHeader(normalized);

  const probePath =
    process.env.WORKSPACE_LOOKUP_PROBE_PATH?.trim() || "/api/v2/auth/workspace-host";

  let data: WorkspaceTenantMetadata | null = null;
  try {
    const res = await fetch(`${probeOrigin}${probePath}`, {
      method: "GET",
      headers: { host, Accept: "application/json" },
      cache: "no-store",
    });

    if (res.status === 200) {
      const body = (await res.json()) as { tenant_id: string; slug: string };
      data = { tenantId: body.tenant_id, slug: body.slug };
    } else if (res.status === 204) {
      // Compatibility with older API versions
      data = { tenantId: "unknown", slug: normalized };
    } else {
      data = null;
    }
  } catch {
    data = failOpenWhenApiUnreachable() ? { tenantId: "unknown", slug: normalized } : null;
  }

  writeLookupCacheEntry(cacheKey, data, now + cacheTtlMs());
  return data;
}
