"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DenaliLocationPickerEditor } from "./DenaliLocationPickerEditor";
import {
  denaliLocationDataIsEmpty,
  denaliLocationDataOrEmpty,
  EMPTY_DENALI_LOCATION,
} from "./denaliLocationFieldUtils";

export type DenaliItineraryDayLocationFieldProps = {
  day: number;
  value: DenaliLocationDataForm | undefined;
  onChange: (location: DenaliLocationDataForm | undefined, locationText?: string) => void;
  fieldErrors?:
    | {
        addressText?: { message?: string };
        latitude?: { message?: string };
        longitude?: { message?: string };
      }
    | undefined;
};

/** Optional per-day geolocation (search + modal map) for multi-day itinerary rows. */
export function DenaliItineraryDayLocationField({
  day,
  value,
  onChange,
  fieldErrors,
}: DenaliItineraryDayLocationFieldProps) {
  const t = useTranslations("tours.denali");
  const loc = denaliLocationDataOrEmpty(value);

  const patch = useCallback(
    (partial: Partial<DenaliLocationDataForm>) => {
      const next = { ...EMPTY_DENALI_LOCATION, ...loc, ...partial };
      const label = next.addressText?.trim();
      if (denaliLocationDataIsEmpty(next)) {
        onChange(undefined, undefined);
        return;
      }
      onChange(next, label || undefined);
    },
    [loc, onChange],
  );

  return (
    <DenaliLocationPickerEditor
      testIdKey={`itinerary-day-${day}`}
      modalTitle={t("program.dailyLocationModalTitle", { day })}
      value={loc}
      patch={patch}
      fieldErrors={fieldErrors}
      searchLabel={t("program.dailyLocationDay", { day })}
      searchHint={t("program.dailyLocationGeolocationHint")}
    />
  );
}
