"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { tourKeys } from "@/lib/query-keys";
import {
  getTours,
  type GetToursParams,
  type PaginatedToursResult,
  type TourDetailDto,
} from "@/lib/services/tours.service";

import type { TourListQueryModel } from "./query-model";

function buildGetToursParams(query: TourListQueryModel): GetToursParams {
  return {
    search: query.search.trim(),
    page: query.page,
    limit: query.limit,
    ...(query.status !== "all" ? { status: query.status } : {}),
  };
}

export function useToursData(
  query: TourListQueryModel,
  options?: { enabled?: boolean }
): {
  tours: TourDetailDto[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const enabled = (options?.enabled ?? true) && authBffQueryEnabled;
  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedToursResult>({
    queryKey: [...tourKeys.listRoot(tenantId ?? ""), query],
    queryFn: ({ signal }) => getTours(buildGetToursParams(query), { signal }),
    enabled,
  });

  return {
    tours: data?.tours ?? [],
    total: data?.total ?? 0,
    page: query.page,
    limit: query.limit,
    isLoading,
    isFetching,
    error,
    refetch: () => {
      void refetch();
    },
  };
}
