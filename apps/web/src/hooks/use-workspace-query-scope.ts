"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useTenantContext } from "@/lib/tenant/tenant-provider";

/**
 * Workspace scope for React Query keys (prefer JWT tenant id).
 * Pair with {@link useAuthBffQueryGateForTenant} for `enabled` — do not fetch on host slug alone before hydrate.
 */
export function useWorkspaceQueryScope(): string | null {
  const { user, isHydrated } = useAuth();
  const tenant = useTenantContext();

  if (!isHydrated) {
    return null;
  }

  const fromAuth = user?.tenantId?.trim();
  if (fromAuth) {
    return fromAuth;
  }

  const fromTenant = tenant.tenantId?.trim() || tenant.tenantSlug?.trim();
  return fromTenant || null;
}
