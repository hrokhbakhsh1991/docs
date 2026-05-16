"use client";

import { useQuery } from "@tanstack/react-query";

import { leaderDashboardSummaryKey } from "@/lib/query-keys";
import { getLeaderDashboardSummary } from "@/lib/services/leader-dashboard.service";

export { leaderDashboardSummaryKey };

export function useLeaderDashboardSummary(enabled: boolean) {
  return useQuery({
    queryKey: leaderDashboardSummaryKey,
    queryFn: () => getLeaderDashboardSummary(),
    enabled,
    staleTime: 30_000,
  });
}
