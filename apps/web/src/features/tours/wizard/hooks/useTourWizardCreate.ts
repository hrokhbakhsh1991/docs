"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { mapFormValuesToBackendPayload } from "@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload";
import { stripInactiveTourCreateGroupsForProfile } from "@/features/tours/wizard/fieldGroups";
import { createTour } from "@/lib/services/tours.service";
import { tourKeys } from "@/lib/query-keys";

export function useTourWizardCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      values: TourCreateFormValues;
      themeCatalog?: readonly { id: string; name: string }[];
      formProfile: TourFormProfile;
    }) => {
      const stripped = stripInactiveTourCreateGroupsForProfile(input.formProfile, input.values);
      const dto = mapFormValuesToBackendPayload(stripped);
      return createTour(
        mapCreateTourDto(
          { ...dto, formProfile: input.formProfile },
          { themeCatalog: input.themeCatalog },
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
    },
  });
}
