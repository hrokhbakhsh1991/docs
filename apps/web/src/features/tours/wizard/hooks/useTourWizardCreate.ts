"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tourKeys } from "@/lib/query-keys";
import { createTour } from "@/lib/services/tours.service";
import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapFormValuesToBackendPayload } from "@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";

export function useTourWizardCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      values: TourCreateFormValues;
      themeCatalog?: readonly { id: string; name: string }[];
    }) => {
      const dto = mapFormValuesToBackendPayload(input.values);
      return createTour(
        mapCreateTourDto(
          dto,
          { themeCatalog: input.themeCatalog },
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
    },
  });
}
