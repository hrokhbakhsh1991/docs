"use client";

import { useAuth } from "@/lib/auth/auth-context";

/**
 * Standard gate for same-origin BFF / session-cookie React Query reads.
 * Prevents premature requests (and 401s) before {@link AuthProvider} hydration completes.
 */
export function useAuthBffQueryGate() {
  const { isHydrated, isAuthenticated } = useAuth();
  const authBffQueryEnabled = isHydrated && isAuthenticated;
  return { isHydrated, isAuthenticated, authBffQueryEnabled };
}

/**
 * Workspace-scoped BFF reads: require tenant scope **and** hydrated authenticated session.
 */
export function useAuthBffQueryGateForTenant(tenantId: string | null | undefined) {
  const gate = useAuthBffQueryGate();
  const scopedTenantId = tenantId?.trim() ?? "";
  return {
    ...gate,
    authBffQueryEnabled: Boolean(scopedTenantId) && gate.authBffQueryEnabled,
  };
}
