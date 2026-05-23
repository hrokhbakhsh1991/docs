"use client";

import { useFieldArray, Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, FormField, JalaliTimePicker } from "@tour/ui";

import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DenaliLocationPickerEditor } from "./DenaliLocationPickerEditor";
import { denaliLocationDataOrEmpty, EMPTY_DENALI_LOCATION } from "./denaliLocationFieldUtils";
import { useDenaliCanonical } from "../DenaliCanonicalContext";

export type DenaliGatheringPointsWidgetProps = {
  name: string;
};

export function DenaliGatheringPointsWidget({ name }: DenaliGatheringPointsWidgetProps) {
  const tNew = useTranslations("tours.new");
  const { control, getValues, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const { updateCanonical } = useDenaliCanonical();

  const syncToCanonical = (nextFields: any[]) => {
    updateCanonical({ gatheringPoints: nextFields });
  };

  const handleAdd = () => {
    const nextRow = {
      id: crypto.randomUUID(),
      title: "",
      time: "",
      location: { ...EMPTY_DENALI_LOCATION },
    };
    append(nextRow);
    syncToCanonical([...(getValues(name) ?? []), nextRow]);
  };

  const handleRemove = (index: number) => {
    remove(index);
    const current = [...(getValues(name) ?? [])];
    current.splice(index, 1);
    syncToCanonical(current);
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }} data-testid="denali-gathering-points-widget">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>ایستگاه‌های تجمع</h3>
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          افزودن ایستگاه
        </Button>
      </div>

      {fields.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
          حداقل یک ایستگاه تجمع برای انتشار تور الزامی است.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "1.25rem" }}>
        {fields.map((field, index) => (
          <fieldset
            key={field.id}
            data-testid={`denali-gathering-point-${index}`}
            style={{
              border: "1px dashed var(--color-border-subtle, #e2e8f0)",
              borderRadius: 6,
              padding: "0.75rem",
              margin: 0,
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 0.25rem" }}>
              ایستگاه {index + 1}
            </legend>

            <div
              dir="rtl"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "0.75rem",
              }}
            >
              <FormField label="ساعت حضور (مثلاً ۰۶:۰۰)" style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name={`${name}.${index}.time`}
                  render={({ field: timeField }) => (
                    <JalaliTimePicker
                      value={timeField.value ?? ""}
                      onChange={(time) => {
                        const val = time || undefined;
                        timeField.onChange(val);
                        syncToCanonical(getValues(name));
                      }}
                      minuteStep={5}
                      hourLabel={tNew("trip_timeHourLabel")}
                      minuteLabel={tNew("trip_timeMinuteLabel")}
                      confirmLabel={tNew("trip_timeConfirm")}
                      cancelLabel={tNew("trip_timeCancel")}
                      clearLabel={tNew("trip_timeClear")}
                      openPickerAriaLabel={tNew("trip_timeOpenPickerAria")}
                    />
                  )}
                />
              </FormField>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                style={{ color: "var(--color-danger-600, #dc2626)", height: "2.5rem" }}
              >
                حذف این ایستگاه
              </Button>
            </div>

            <Controller
              control={control}
              name={`${name}.${index}.location`}
              render={({ field: locationField }) => {
                const locValue = denaliLocationDataOrEmpty(locationField.value as DenaliLocationDataForm);
                return (
                  <DenaliLocationPickerEditor
                    testIdKey={`gathering-point-${index}`}
                    modalTitle={`انتخاب ایستگاه ${index + 1} روی نقشه`}
                    value={locValue}
                    patch={(partial) => {
                      const nextLoc = {
                        ...EMPTY_DENALI_LOCATION,
                        ...locValue,
                        ...partial,
                      };
                      locationField.onChange(nextLoc);
                      
                      // Sync addressText to the station title for parity with the "other 4" behavior
                      if (partial.addressText !== undefined) {
                        setValue(`${name}.${index}.title`, partial.addressText);
                      }
                      
                      syncToCanonical(getValues(name));
                    }}
                    searchLabel="نام و آدرس ایستگاه (جستجوی خودکار)"
                    searchHint="با جستجوی نام مکان، مختصات آن نیز ثبت می‌شود."
                  />
                );
              }}
            />
          </fieldset>
        ))}
      </div>
    </div>
  );
}
