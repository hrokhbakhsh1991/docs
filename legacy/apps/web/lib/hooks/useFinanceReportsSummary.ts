"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { financeReportsSummaryKeys } from "@/lib/query-keys";
import { getFinanceReportsSummary } from "@/lib/services/finance-reports.service";

/** @deprecated Use {@link financeReportsSummaryKeys.detail} */
export const financeReportsSummaryKey = financeReportsSummaryKeys.all;

export function useFinanceReportsSummary(enabled: boolean) {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: financeReportsSummaryKeys.detail(tenantId ?? ""),
    queryFn: () => getFinanceReportsSummary(),
    enabled: enabled && authBffQueryEnabled,
    staleTime: 30_000,
  });
}
