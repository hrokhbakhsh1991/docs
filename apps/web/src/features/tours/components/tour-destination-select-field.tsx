"use client";

import { useTranslations } from "next-intl";
import type { Control, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { FormField, Select } from "@tour/ui";

import type { TourDestinationGroup } from "@/hooks/use-tour-destinations";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";

export type TourDestinationSelectFieldProps = {
  control: Control<FieldValues>;
  name: string;
  groupedRegions: TourDestinationGroup[];
  /** Current tour destination when it is inactive in Settings — shown as a disabled option. */
  inactiveSelection?: SettingsDestinationDto | null;
  error?: string;
  disabled?: boolean;
};

export function TourDestinationSelectField({
  control,
  name,
  groupedRegions,
  inactiveSelection,
  error,
  disabled,
}: TourDestinationSelectFieldProps) {
  const t = useTranslations("tours.new");

  return (
    <FormField label={t("destinationFieldLabel")} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const value = typeof field.value === "string" ? field.value : field.value ?? "";
          const strVal = value === null || value === undefined ? "" : String(value);
          const inactiveId = inactiveSelection?.id;
          const inGrouped =
            strVal !== "" &&
            groupedRegions.some((g) => g.items.some((d) => d.id === strVal));
          const showInactiveOption =
            Boolean(inactiveSelection && inactiveId && strVal === inactiveId) &&
            (!inactiveSelection!.isActive || !inGrouped);

          return (
            <Select
              invalid={Boolean(error)}
              disabled={disabled}
              value={strVal}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(v === "" ? null : v);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            >
              <option value="">{t("destinationPlaceholder")}</option>
              {showInactiveOption && inactiveSelection ? (
                <option value={inactiveId} disabled>
                  {inactiveSelection.name} {t("destinationInactiveSuffix")}
                </option>
              ) : null}
              {groupedRegions.map((group) => (
                <optgroup key={group.regionId} label={group.regionName}>
                  {group.items.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          );
        }}
      />
    </FormField>
  );
}
