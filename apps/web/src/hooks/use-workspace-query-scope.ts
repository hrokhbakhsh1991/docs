"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import {
  resolveTenantSlugFromHost,
  type TenantContext,
} from "@/lib/tenant/runtime-tenant-context";

/** Workspace scope for React Query keys and wizard draft storage (prefer JWT tenant id). */
export function useWorkspaceQueryScope(): string | null {
  const { user, isHydrated } = useAuth();
  const tenant = useTenantContext();

  if (!isHydrated) {
    const early = tenant.tenantId?.trim() || tenant.tenantSlug?.trim();
    return early || null;
  }

  const fromAuth = user?.tenantId?.trim();
  if (fromAuth) {
    return fromAuth;
  }

  const fromTenant = tenant.tenantId?.trim() || tenant.tenantSlug?.trim();
  return fromTenant || null;
}

/**
 * Resolves wizard draft scope: server slug → browser host label → JWT/query scope.
 * Host fallback keeps keys stable when the client tree only has `tenant_id` after hydrate.
 */
export function resolveWorkspaceDraftScope(
  tenant: TenantContext,
  queryScope: string | null,
  host?: string | null,
): string | null {
  if (host) {
    const fromHost = resolveTenantSlugFromHost(host);
    if (fromHost) {
      return fromHost;
    }
  }
  const slug = tenant.tenantSlug?.trim().toLowerCase();
  if (slug) {
    return slug;
  }
  const fromQuery = queryScope?.trim();
  return fromQuery || null;
}

/**
 * Scope for wizard `localStorage` keys. Prefer workspace subdomain label so the key does not
 * flip from slug → JWT `tenant_id` after auth hydrate (which broke draft restore on first paint).
 */
export function useWorkspaceDraftScope(): string | null {
  const tenant = useTenantContext();
  const queryScope = useWorkspaceQueryScope();
  const host = typeof window !== "undefined" ? window.location.host : null;
  return resolveWorkspaceDraftScope(tenant, queryScope, host);
}
