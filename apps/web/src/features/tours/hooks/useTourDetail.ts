"use client";

import { useQuery } from "@tanstack/react-query";

import { tourKeys } from "@/lib/query-keys";
import { getTourById, type TourDetailDto } from "@/lib/services/tours.service";

export function useTourDetail(
  tourId: string,
  options?: { enabled?: boolean }
): {
  tour: TourDetailDto | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const enabled = Boolean(tourId?.trim()) && (options?.enabled ?? true);
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled,
  });
  const isLoading = enabled && isPending;

  return {
    tour: data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: () => {
      void refetch();
    },
  };
}
