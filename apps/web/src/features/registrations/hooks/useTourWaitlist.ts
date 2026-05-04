"use client";

import { useQuery } from "@tanstack/react-query";

import type { WaitlistItemResponseDto } from "@repo/types";

import { registrationKeys } from "@/lib/query-keys";
import { listWaitlistItemsForTour } from "@/lib/services/registrations.service";

export function useTourWaitlist(
  tourId: string,
  options?: { enabled?: boolean }
): {
  waitlist: WaitlistItemResponseDto[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const enabled = Boolean(tourId?.trim()) && (options?.enabled ?? true);
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: registrationKeys.tourWaitlist(tourId),
    queryFn: () => listWaitlistItemsForTour(tourId),
    enabled,
  });
  const isLoading = enabled && isPending;

  return {
    waitlist: data ?? [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch: () => {
      void refetch();
    },
  };
}
