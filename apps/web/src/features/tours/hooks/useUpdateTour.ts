"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tourKeys } from "@/lib/query-keys";
import { updateTour, type UpdateTourDto } from "@/lib/services/tours.service";

export function useUpdateTour(tourId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      dto: UpdateTourDto;
      mergeCostFrom: Record<string, unknown> | null | undefined;
    }) =>
      updateTour(tourId, payload.dto, {
        existingCostContext: payload.mergeCostFrom ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
      void queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tourKeys.catalog() });
    },
  });
}
