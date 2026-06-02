"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { tourKeys } from "@/lib/query-keys";
import { updateTour, type UpdateTourDto } from "@/lib/services/tours.service";

export function useUpdateTour(tourId: string) {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();

  return useMutation({
    mutationFn: async (payload: {
      dto: UpdateTourDto;
      mergeCostFrom: Record<string, unknown> | null | undefined;
    }) =>
      updateTour(tourId, payload.dto, {
        existingCostContext: payload.mergeCostFrom ?? null,
      }),
    onSuccess: () => {
      const scopedTenantId = tenantId?.trim() ?? "";
      if (scopedTenantId) {
        void queryClient.invalidateQueries({ queryKey: tourKeys.detail(scopedTenantId, tourId) });
        void queryClient.invalidateQueries({ queryKey: tourKeys.listRoot(scopedTenantId) });
        void queryClient.invalidateQueries({ queryKey: tourKeys.catalog(scopedTenantId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      }
    },
  });
}
