"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { financeLedgerEventsKeys } from "@/lib/query-keys";
import { listFinanceLedgerEvents } from "@/lib/services/finance-reports.service";

/** @deprecated Use {@link financeLedgerEventsKeys.list} */
export const financeLedgerEventsKey = financeLedgerEventsKeys.all;

export function useFinanceLedgerEvents(enabled: boolean) {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: financeLedgerEventsKeys.list(tenantId ?? ""),
    queryFn: () => listFinanceLedgerEvents(),
    enabled: enabled && authBffQueryEnabled,
    staleTime: 30_000,
  });
}
