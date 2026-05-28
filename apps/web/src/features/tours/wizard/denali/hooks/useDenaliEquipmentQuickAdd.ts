"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFormContext } from "react-hook-form";

import {
  EquipmentQuickAddForm,
  useQuickAddModal,
} from "@/components/shared/QuickAddModal";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { settingsEquipmentKeys } from "@/lib/query-keys";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { normalizeGearItems, upsertGearItem } from "../denaliGearSelection";

/** Opens catalog QuickAdd for equipment; appends to gear list on success. */
export function useDenaliEquipmentQuickAdd() {
  const quickAdd = useQuickAddModal();
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  const { getValues, setValue } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();

  const commitGearItems = useCallback(
    (next: ReturnType<typeof normalizeGearItems>) => {
      const normalized = normalizeGearItems(next);
      setValue("participantRequirements.gearItems", normalized, {
        shouldDirty: true,
        shouldValidate: true,
      });
      const snapshot = getValues();
      updateCanonical({
        participants: {
          minimumAge: snapshot.participantRequirements.minimumAge,
          maximumAge: snapshot.participantRequirements.maximumAge,
          fitnessLevel: snapshot.participantRequirements.fitnessLevel,
          sportsInsuranceRequired: snapshot.participantRequirements.sportsInsuranceRequired,
          fitnessPrerequisiteText: snapshot.participantRequirements.fitnessPrerequisiteText,
          gearItems: normalized,
        },
      });
    },
    [getValues, setValue, updateCanonical],
  );

  return useCallback(() => {
    quickAdd.open({
      entityType: "equipment",
      title: "افزودن تجهیز جدید",
      description: "تجهیز به کاتالوگ اضافه می‌شود و بلافاصله به لیست تجهیزات این تور وصل می‌شود.",
      formComponent: EquipmentQuickAddForm,
      onSuccess: (equipment) => {
        const current = getValues().participantRequirements.gearItems;
        commitGearItems(upsertGearItem(current, equipment.id, { isRequired: false }));
        if (tenantId) {
          void queryClient.invalidateQueries({
            queryKey: settingsEquipmentKeys.list(tenantId),
          });
        }
      },
    });
  }, [commitGearItems, getValues, quickAdd, queryClient, tenantId]);
}
