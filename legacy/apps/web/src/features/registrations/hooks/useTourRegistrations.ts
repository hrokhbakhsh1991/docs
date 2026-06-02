"use client";

import { useQuery } from "@tanstack/react-query";

import type { BookingDto } from "@repo/types";

import { registrationKeys } from "@/lib/query-keys";
import { listRegistrationsForTour } from "@/lib/services/registrations.service";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

export function useTourRegistrations(
  tourId: string,
  options?: { enabled?: boolean }
): {
  registrations: BookingDto[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const tenantId = useWorkspaceQueryScope();
  const enabled = Boolean(tourId?.trim() && tenantId?.trim()) && (options?.enabled ?? true);
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: registrationKeys.tourRegistrations(tenantId ?? "", tourId),
    queryFn: ({ signal }) => listRegistrationsForTour(tourId, { signal }),
    enabled,
  });
  const isLoading = enabled && isPending;

  return {
    registrations: data ?? [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch: () => {
      void refetch();
    },
  };
}
