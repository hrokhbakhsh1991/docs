"use client";

import { useFieldArray, Controller, useFormContext, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, FormField, JalaliTimePicker } from "@tour/ui";

import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DenaliLocationPickerEditor } from "./DenaliLocationPickerEditor";
import { denaliLocationDataOrEmpty, EMPTY_DENALI_LOCATION } from "./denaliLocationFieldUtils";
import { useDenaliCanonicalOptional } from "../DenaliCanonicalContext";

export type DenaliGatheringPointsWidgetProps = {
  name: string;
};

function readRhfErrorMessage(errors: FieldErrors, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = errors;
  for (const part of parts) {
    if (node == null || typeof node !== "object") {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (
    node &&
    typeof node === "object" &&
    "message" in node &&
    typeof (node as { message?: unknown }).message === "string"
  ) {
    return (node as { message: string }).message;
  }
  return undefined;
}

export function DenaliGatheringPointsWidget({ name }: DenaliGatheringPointsWidgetProps) {
  const tNew = useTranslations("tours.new");
  const { control, getValues, setValue, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const canonical = useDenaliCanonicalOptional();

  const syncToCanonical = (nextFields: any[]) => {
    canonical?.updateCanonical({ gatheringPoints: nextFields });
  };

  const rootError = readRhfErrorMessage(errors, name);

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
    if (fields.length <= 1) {
      return;
    }
    remove(index);
    const current = [...(getValues(name) ?? [])];
    current.splice(index, 1);
    syncToCanonical(current);
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }} data-testid="denali-gathering-points-widget" data-field-path={name}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>ایستگاه‌های تجمع</h3>
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          افزودن ایستگاه
        </Button>
      </div>

      {rootError ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-600, #dc2626)" }}
          data-testid="denali-gathering-points-root-error"
        >
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
          حداقل یک ایستگاه تجمع برای انتشار تور الزامی است.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "1.25rem" }}>
        {fields.map((field, index) => {
          const stationError = readRhfErrorMessage(errors, `${name}.${index}`);
          return (
          <fieldset
            key={field.id}
            data-testid={`denali-gathering-point-${index}`}
            data-field-path={`${name}.${index}`}
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

            {stationError ? (
              <p
                role="alert"
                style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-600, #dc2626)" }}
              >
                {stationError}
              </p>
            ) : null}

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

              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  style={{ color: "var(--color-danger-600, #dc2626)", height: "2.5rem" }}
                >
                  حذف این ایستگاه
                </Button>
              ) : null}
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
          );
        })}
      </div>
    </div>
  );
}
