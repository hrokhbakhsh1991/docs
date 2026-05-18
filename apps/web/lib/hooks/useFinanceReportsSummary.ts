"use client";

import { useQuery } from "@tanstack/react-query";

import { getFinanceReportsSummary } from "@/lib/services/finance-reports.service";

export const financeReportsSummaryKey = ["finance", "reports", "summary"] as const;

export function useFinanceReportsSummary(enabled: boolean) {
  return useQuery({
    queryKey: financeReportsSummaryKey,
    queryFn: () => getFinanceReportsSummary(),
    enabled,
    staleTime: 30_000,
  });
}
