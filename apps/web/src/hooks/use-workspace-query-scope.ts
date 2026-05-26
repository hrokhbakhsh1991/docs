"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useTenantContext } from "@/lib/tenant/tenant-provider";

/** Workspace scope for React Query keys (prefer JWT tenant id). */
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
