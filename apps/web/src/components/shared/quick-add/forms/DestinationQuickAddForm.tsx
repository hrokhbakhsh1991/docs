"use client";

import { useCallback, useMemo } from "react";

import {
  DestinationForm,
  type DestinationFormParsed,
} from "@/app/(app)/settings/locations/destination-form";
import { useSettingsDestinations } from "@/hooks/use-settings-destinations";
import { useSettingsRegions } from "@/hooks/use-settings-regions";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";

import { formatQuickAddApiError } from "../formatQuickAddApiError";
import type { QuickAddFormProps } from "../types";

export function DestinationQuickAddForm({
  onSuccess,
  onCancel,
  isPending,
  setError,
  setPending,
}: QuickAddFormProps<SettingsDestinationDto>) {
  const regionsQuery = useSettingsRegions();
  const { createDestination, isMutating } = useSettingsDestinations();

  const defaultRegionId = useMemo(() => {
    const active = regionsQuery.regions.find((r) => r.isActive);
    return active?.id ?? regionsQuery.regions[0]?.id ?? "";
  }, [regionsQuery.regions]);

  const handleSubmit = useCallback(
    async (values: DestinationFormParsed) => {
      setError(null);
      setPending(true);
      try {
        const created = await createDestination({
          name: values.name,
          regionId: values.regionId,
          type: values.type,
          altitudeM: values.altitudeM ?? null,
          sortOrder: values.sortOrder ?? null,
          isActive: values.isActive,
        });
        onSuccess(created);
      } catch (err) {
        setError(formatQuickAddApiError(err));
      } finally {
        setPending(false);
      }
    },
    [createDestination, onSuccess, setError, setPending],
  );

  const pending = isPending || isMutating || regionsQuery.isLoading;

  return (
    <DestinationForm
      editing={null}
      defaultRegionIdWhenCreating={defaultRegionId}
      allRegions={regionsQuery.regions}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={pending}
    />
  );
}
