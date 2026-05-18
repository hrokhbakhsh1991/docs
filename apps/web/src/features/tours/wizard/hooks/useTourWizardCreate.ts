"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { wizardFormToCreateTourApiPayload } from "@/features/tours/wizard/contract/tour-wizard-contract";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { stripTenantGatedTourCreateGroups } from "@/features/tours/contracts/tenant-tour-form-contract";
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
      tenantFormContract?: TenantTourFormContract;
    }) => {
      let stripped = stripInactiveTourCreateGroupsForProfile(input.formProfile, input.values);
      if (input.tenantFormContract) {
        stripped = stripTenantGatedTourCreateGroups(input.tenantFormContract, stripped);
      }
      const dto = wizardFormToCreateTourApiPayload(input.formProfile, stripped);
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
