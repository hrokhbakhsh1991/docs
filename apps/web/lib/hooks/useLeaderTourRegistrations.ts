"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { registrationKeys, tourKeys } from "@/lib/query-keys";
import { listRegistrationsForTour } from "@/lib/services/registrations.service";
import { getTours } from "@/lib/services/tours.service";

import type { BookingDto } from "@repo/types";

export type LeaderRegistrationRow = BookingDto & {
  tourTitle: string;
};

export function useLeaderTourRegistrations(enabled: boolean) {
  const toursQuery = useQuery({
    queryKey: tourKeys.list({ search: "" }),
    queryFn: () => getTours({ search: "" }),
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
