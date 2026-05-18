"use client";

import { useQuery } from "@tanstack/react-query";

import { listFinanceLedgerEvents } from "@/lib/services/finance-reports.service";

export const financeLedgerEventsKey = ["finance", "reports", "ledger-events"] as const;

export function useFinanceLedgerEvents(enabled: boolean) {
  return useQuery({
    queryKey: financeLedgerEventsKey,
    queryFn: () => listFinanceLedgerEvents(),
    enabled,
    staleTime: 30_000,
  });
}
