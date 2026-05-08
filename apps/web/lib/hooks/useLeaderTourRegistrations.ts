"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { leaderDashboardUseAggregateApi } from "@/lib/config/feature-flags";
import { registrationKeys, tourKeys } from "@/lib/query-keys";
import { listRegistrationsForTour } from "@/lib/services/registrations.service";
import { getLeaderWorkspaceAggregate } from "@/lib/services/leader-workspace.service";
import { DEFAULT_MAX_TOUR_PAGES, fetchAllToursSafely } from "@/lib/tours/fetchAllToursSafely";

import type { BookingDto } from "@repo/types";

export type LeaderRegistrationRow = BookingDto & {
  tourTitle: string;
};

export function useLeaderTourRegistrations(enabled: boolean) {
  const useAggregateApi = leaderDashboardUseAggregateApi();

  const toursQuery = useQuery({
    queryKey: [
      ...tourKeys.lists(),
      useAggregateApi ? "aggregate" : "safe-all",
      { search: "", maxPages: DEFAULT_MAX_TOUR_PAGES },
    ],
    queryFn: async () => {
      if (useAggregateApi) {
        const aggregate = await getLeaderWorkspaceAggregate();
        return {
          tours: aggregate.tours,
          total: aggregate.meta.total,
          limit: aggregate.tours.length || 1,
          pagesFetched: 1,
          partial: aggregate.meta.partial,
        };
      }
      return fetchAllToursSafely({ search: "", maxPages: DEFAULT_MAX_TOUR_PAGES });
    },
    enabled,
    staleTime: 30_000,
  });

  const tourIds = useMemo(
    () => (toursQuery.data?.tours ?? []).map((t) => t.id).filter(Boolean),
    [toursQuery.data?.tours],
  );

  const registrationsQueries = useQueries({
    queries: tourIds.map((tourId) => ({
      queryKey: registrationKeys.tourRegistrations(tourId),
      queryFn: () => listRegistrationsForTour(tourId),
      enabled: enabled && toursQuery.isSuccess && tourIds.length > 0,
      staleTime: 30_000,
    })),
  });

  const rows: LeaderRegistrationRow[] = useMemo(() => {
    const titleById = new Map(
      (toursQuery.data?.tours ?? []).map((t) => [t.id, t.title.trim() || t.id] as const),
    );
    const out: LeaderRegistrationRow[] = [];
    for (let i = 0; i < tourIds.length; i++) {
      const tourId = tourIds[i];
      const q = registrationsQueries[i];
      const list = q?.data ?? [];
      const tourTitle = titleById.get(tourId) ?? tourId;
      for (const r of list) {
        out.push({ ...r, tourTitle });
      }
    }
    return out;
  }, [tourIds, toursQuery.data?.tours, registrationsQueries]);

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "Pending"), [rows]);

  const registrationsLoading =
    toursQuery.isPending || registrationsQueries.some((q) => q.isPending);
  const registrationsError = registrationsQueries.find((q) => q.isError)?.error ?? null;

  return {
    toursQuery,
    tourIds,
    rows,
    pendingRows,
    pendingCount: pendingRows.length,
    totalRegistrationCount: rows.length,
    partial: toursQuery.data?.partial ?? false,
    usingAggregateApi: useAggregateApi,
    isLoading: !enabled ? false : toursQuery.isPending || registrationsLoading,
    isError: toursQuery.isError,
    registrationsError,
    registrationsQueries,
    refetchTours: () => void toursQuery.refetch(),
    refetchAll: async () => {
      await toursQuery.refetch();
      await Promise.all(registrationsQueries.map((q) => q.refetch()));
    },
  };
}
