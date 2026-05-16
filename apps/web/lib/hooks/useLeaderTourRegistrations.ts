"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import { leaderRegistrationIndexKeys } from "@/lib/query-keys";
import { listLeaderRegistrationRows } from "@/lib/services/leader-dashboard.service";

import type { BookingDto } from "@repo/types";

import { useClientMounted } from "./use-client-mounted";

export type LeaderRegistrationRow = BookingDto & {
  tourTitle: string;
};

function isLeaderReviewRoute(pathname: string): boolean {
  return pathname === "/leader/review" || pathname.startsWith("/leader/review/");
}

/**
 * Leader review queue data — single tenant index request (no per-tour fan-out).
 * Gated to `/leader/review` after client mount so dashboard navigation cannot prefetch it.
 */
export function useLeaderTourRegistrations(enabled: boolean) {
  const pathname = usePathname() ?? "";
  const mounted = useClientMounted();
  const routeActive = isLeaderReviewRoute(pathname);
  const queriesEnabled = Boolean(enabled && mounted && routeActive);

  const indexQuery = useQuery({
    queryKey: leaderRegistrationIndexKeys.list(),
    queryFn: () => listLeaderRegistrationRows(),
    enabled: queriesEnabled,
    staleTime: 30_000,
  });

  const rows = indexQuery.data?.rows ?? [];
  const pendingRows = useMemo(() => rows.filter((r) => r.status === "Pending"), [rows]);

  const stubToursQuery = {
    isPending: false,
    isError: false,
    error: null,
    refetch: async () => undefined,
  };

  return {
    toursQuery: stubToursQuery,
    tourIds: [] as string[],
    rows,
    pendingRows,
    pendingCount: pendingRows.length,
    totalRegistrationCount: rows.length,
    partial: indexQuery.data?.partial ?? false,
    usingAggregateApi: true,
    isLoading: queriesEnabled && indexQuery.isPending,
    isError: indexQuery.isError,
    registrationsError: indexQuery.error,
    registrationsQueries: [],
    refetchTours: () => void indexQuery.refetch(),
    refetchAll: async () => {
      await indexQuery.refetch();
    },
  };
}
