"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { useOptionalServerTenantContext } from "@/lib/tenant/tenant-provider";
import { tryResolveClientRuntimeTenantContext } from "@/lib/tenant/runtime-tenant-context";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

/**
 * Workspace scope for React Query keys (prefer JWT tenant id).
 * Pair with {@link useAuthBffQueryGateForTenant} for `enabled` — do not fetch on host slug alone before hydrate.
 *
 * Returns `null` during SSR, before mount, and until {@link AuthProvider} hydration completes.
 */
export function useWorkspaceQueryScope(): string | null {
  const { user, isHydrated } = useAuth();
  const serverTenant = useOptionalServerTenantContext();
  const mounted = useClientMounted();
  const [clientScope, setClientScope] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted || serverTenant) {
      return;
    }
    const ctx = tryResolveClientRuntimeTenantContext();
    const scoped = ctx?.tenantId?.trim() || ctx?.tenantSlug?.trim() || null;
    setClientScope(scoped);
  }, [mounted, serverTenant]);

  if (!mounted || !isHydrated) {
    return null;
  }

  const fromAuth = user?.tenantId?.trim();
  if (fromAuth) {
    return fromAuth;
  }

  const fromServer =
    serverTenant?.tenantId?.trim() || serverTenant?.tenantSlug?.trim() || null;
  if (fromServer) {
    return fromServer;
  }

  return clientScope;
}
