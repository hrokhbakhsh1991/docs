"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { evictWorkspaceQueryCaches } from "@/lib/query/evict-workspace-query-cache";

/**
 * Evicts React Query caches for the previous workspace when JWT `tenant_id` changes
 * (workspace picker / session switch). Uses {@link QueryClient.removeQueries} — not
 * invalidate — so stale prior-tenant keys are deleted from memory and cannot trigger
 * ghost background refetches after the session has moved to another tenant.
 */
export function useInvalidateWorkspaceQueriesOnSwitch(): void {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const prevTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    const tenantId = user?.tenantId?.trim() || null;
    const prev = prevTenantIdRef.current;
    if (prev && tenantId && prev !== tenantId) {
      evictWorkspaceQueryCaches(queryClient);
    }
    prevTenantIdRef.current = tenantId;
  }, [queryClient, user?.tenantId]);
}
