"use client";

import { useQuery } from "@tanstack/react-query";

import { leaderDashboardSummaryKeys } from "@/lib/query-keys";
import { getLeaderDashboardSummary } from "@/lib/services/leader-dashboard.service";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

export { leaderDashboardSummaryKeys };

export function useLeaderDashboardSummary(enabled: boolean) {
  const tenantId = useWorkspaceQueryScope() ?? "";
  return useQuery({
    queryKey: leaderDashboardSummaryKeys.detail(tenantId),
    queryFn: () => getLeaderDashboardSummary(),
    enabled: enabled && Boolean(tenantId),
    staleTime: 30_000,
  });
}
