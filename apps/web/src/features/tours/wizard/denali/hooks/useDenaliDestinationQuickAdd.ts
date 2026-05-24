"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFormContext } from "react-hook-form";

import {
  DestinationQuickAddForm,
  useQuickAddModal,
} from "@/components/shared/QuickAddModal";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { settingsLocationsKeys } from "@/lib/query-keys";

import { useDenaliCanonical } from "../DenaliCanonicalContext";

/** Opens catalog QuickAdd for destinations; syncs RHF + canonical on success. */
export function useDenaliDestinationQuickAdd() {
  const quickAdd = useQuickAddModal();
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  const { setValue } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();

  return useCallback(() => {
    quickAdd.open({
      entityType: "destination",
      title: "افزودن مقصد جدید",
      description:
        "مقصد به کاتالوگ workspace اضافه می‌شود. پس از ذخیره، در همین گام قابل انتخاب است.",
      persistWizardState: true,
      formComponent: DestinationQuickAddForm,
      onSuccess: (destination) => {
        updateCanonical({ destinationId: destination.id });
        setValue("basicInfo.destinationId", destination.id, {
          shouldDirty: true,
          shouldValidate: true,
        });
        if (tenantId) {
          void queryClient.invalidateQueries({
            queryKey: settingsLocationsKeys.destinations(tenantId),
          });
          void queryClient.invalidateQueries({
            queryKey: settingsLocationsKeys.regions(tenantId),
          });
        }
      },
    });
  }, [quickAdd, queryClient, setValue, tenantId, updateCanonical]);
}
