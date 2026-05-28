"use client";

import { useMemo } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, JalaliDatePicker, JalaliTimePicker } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical } from "./DenaliCanonicalContext";
import { combineYmdAndTimeToIso, parseIsoToYmdAndTime } from "./denaliDatetime";

type CanonicalDatetimeField = "startDateTime" | "endDateTime";

type Props = {
  field: CanonicalDatetimeField;
  label: string;
  optional?: boolean;
};

function toGregorianYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DenaliDatetimeField({ field, label, optional }: Props) {
  const t = useTranslations("tours.denali");
  const tNew = useTranslations("tours.new");
  const { control } = useFormContext<DenaliCreateTourWizardForm>();

  const { updateCanonical } = useDenaliCanonical();

  const todayYmd = useMemo(() => toGregorianYmd(new Date()), []);
  const maxYmd = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return toGregorianYmd(d);
  }, []);

  const namePath = field === "startDateTime" ? "basicInfo.startDateTime" : "basicInfo.endDateTime";

  return (
    <Controller
      name={namePath}
      control={control}
      render={({ field: rhfField, fieldState }) => {
        const errorMessage = fieldState.error?.message;
        const isoValue = typeof rhfField.value === "string" ? rhfField.value : undefined;
        const { ymd, time } = parseIsoToYmdAndTime(isoValue);

        const setParts = (nextYmd: string, nextTime: string) => {
          const nextIso = combineYmdAndTimeToIso(nextYmd, nextTime);
          rhfField.onChange(nextIso ?? (field === "startDateTime" ? "" : undefined));
          if (field === "startDateTime") {
            updateCanonical({ startDateTime: nextIso ?? "" });
          } else {
            updateCanonical({ endDateTime: nextIso ?? undefined });
          }
        };

        return (
          <FormField label={label} error={errorMessage}>
            <div>
              <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr" }}>
                <JalaliDatePicker
                  value={ymd}
                  onChange={(v) => setParts(v, time)}
                  minDate={todayYmd}
                  maxDate={maxYmd}
                  clearLabel={tNew("trip_jalaliClear")}
                  openCalendarAriaLabel={tNew("trip_openCalendarAria")}
                  invalid={Boolean(errorMessage)}
                />
                <JalaliTimePicker
                  value={time}
                  onChange={(v) => setParts(ymd, v)}
                  invalid={Boolean(errorMessage)}
                  minuteStep={5}
                  hourLabel={tNew("trip_timeHourLabel")}
                  minuteLabel={tNew("trip_timeMinuteLabel")}
                  confirmLabel={tNew("trip_timeConfirm")}
                  cancelLabel={tNew("trip_timeCancel")}
                  clearLabel={tNew("trip_timeClear")}
                  openPickerAriaLabel={tNew("trip_timeOpenPickerAria")}
                />
              </div>
              {optional ? (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  {t("datetimeOptionalHint")}
                </p>
              ) : null}
            </div>
          </FormField>
        );
      }}
    />
  );
}
