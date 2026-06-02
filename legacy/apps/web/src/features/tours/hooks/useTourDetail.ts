"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
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
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const enabled =
    Boolean(tourId?.trim()) && authBffQueryEnabled && (options?.enabled ?? true);
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: tourKeys.detail(tenantId ?? "", tourId),
    queryFn: ({ signal }) => getTourById(tourId, { signal }),
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
