"use client";

import type { TourFormProfile } from "@repo/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
/**
 * Classic 9-step wizard only. Denali 6-tab create uses {@link useDenaliTourWizardCreate}
 * → {@link createTourFromDenaliWizardForm} (same mapCreateTourDto pipeline, separate hook to avoid rules-of-hooks branching).
 */
import { createTourFromClassicWizardForm } from "@/features/tours/wizard/domain/createTourFromWizard";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { tourKeys } from "@/lib/query-keys";

export function useTourWizardCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      values: TourCreateFormValues;
      themeCatalog?: readonly { id: string; name: string }[];
      workspaceFormProfile: TourFormProfile;
      tenantFormContract?: TenantTourFormContract;
      sourcePresetId?: string;
      sourceTourId?: string;
    }) => {
      return createTourFromClassicWizardForm({
        values: input.values,
        workspaceFormProfile: input.workspaceFormProfile,
        themeCatalog: input.themeCatalog,
        tenantFormContract: input.tenantFormContract,
        sourcePresetId: input.sourcePresetId,
        sourceTourId: input.sourceTourId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
    },
  });
}
