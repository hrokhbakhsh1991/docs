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

const lookupCache = new Map<string, { data: WorkspaceTenantMetadata | null; expiresAt: number }>();

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
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const hostCheck = evaluateWorkspaceHost(`${normalized}.${root}`);
  if (!hostCheck.ok) {
    lookupCache.set(cacheKey, { data: null, expiresAt: now + cacheTtlMs() });
    return null;
  }

  const origin = buildTenantSubdomainOrigin(normalized);
  const host = buildTenantHostHeader(normalized);

  const probePath =
    process.env.WORKSPACE_LOOKUP_PROBE_PATH?.trim() || "/api/v2/auth/workspace-host";

  let data: WorkspaceTenantMetadata | null = null;
  try {
    const res = await fetch(`${origin}${probePath}`, {
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

  lookupCache.set(cacheKey, { data, expiresAt: now + cacheTtlMs() });
  return data;
}
