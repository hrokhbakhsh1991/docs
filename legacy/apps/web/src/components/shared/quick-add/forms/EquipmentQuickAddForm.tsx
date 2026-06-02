"use client";

import { useCallback } from "react";

import {
  EquipmentForm,
  type EquipmentFormParsed,
} from "@/app/(app)/settings/equipment/equipment-form";
import { useCreateEquipment } from "@/hooks/use-settings-equipment";
import type { SettingsEquipmentDto } from "@/lib/settings-equipment.client";

import { formatQuickAddApiError } from "../formatQuickAddApiError";
import type { QuickAddFormProps } from "../types";

export function EquipmentQuickAddForm({
  onSuccess,
  onCancel,
  isPending,
  setError,
  setPending,
}: QuickAddFormProps<SettingsEquipmentDto>) {
  const createMutation = useCreateEquipment();

  const handleSubmit = useCallback(
    async (values: EquipmentFormParsed) => {
      setError(null);
      setPending(true);
      try {
        const created = await createMutation.mutateAsync({
          name: values.name,
          slug: values.slug,
          compatibleCategories: values.compatibleCategories,
          description: values.description,
          icon: values.icon,
          isActive: values.isActive,
          ...(values.sortOrder !== undefined ? { sortOrder: values.sortOrder } : {}),
        });
        onSuccess(created);
      } catch (err) {
        setError(formatQuickAddApiError(err));
      } finally {
        setPending(false);
      }
    },
    [createMutation, onSuccess, setError, setPending],
  );

  return (
    <EquipmentForm
      editing={null}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={isPending || createMutation.isPending}
    />
  );
}
