"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/auth-context";

/**
 * Drops React Query caches scoped to the previous workspace when JWT `tenant_id` changes
 * (workspace picker / session switch). Prevents themes/presets/template from leaking across tenants.
 */
export function useInvalidateWorkspaceQueriesOnSwitch(): void {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const prevTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    const tenantId = user?.tenantId?.trim() || null;
    const prev = prevTenantIdRef.current;
    if (prev && tenantId && prev !== tenantId) {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["tours"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["tenantConfig"] });
    }
    prevTenantIdRef.current = tenantId;
  }, [queryClient, user?.tenantId]);
}
