"use client";

import { useFormContext, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, JalaliTimePicker } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical } from "./DenaliCanonicalContext";

type Props = {
  label: string;
};

export function DenaliApproximateReturnTimeField({ label }: Props) {
  const tNew = useTranslations("tours.new");
  const { control } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();

  return (
    <Controller
      name="basicInfo.approximateReturnTime"
      control={control}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message;
        return (
          <FormField label={label} error={errorMessage}>
            <div>
              <JalaliTimePicker
                value={field.value ?? ""}
                onChange={(v) => {
                  const cleaned = v.trim() === "" ? undefined : v;
                  field.onChange(cleaned);
                  updateCanonical({ approximateReturnTime: cleaned });
                }}
                onBlur={field.onBlur}
                invalid={Boolean(errorMessage)}
                minuteStep={5}
                hourLabel={tNew("trip_timeHourLabel")}
                minuteLabel={tNew("trip_timeMinuteLabel")}
                confirmLabel={tNew("trip_timeConfirm")}
                cancelLabel={tNew("trip_timeCancel")}
                clearLabel={tNew("trip_timeClear")}
                openPickerAriaLabel={tNew("trip_timeOpenPickerAria")}
                data-testid="denali-basics-approx-return-time"
              />
            </div>
          </FormField>
        );
      }}
    />
  );
}
