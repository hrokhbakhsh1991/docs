"use client";

import { useCallback } from "react";
import { useFieldArray, Controller, useFormContext, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, FormField, JalaliTimePicker } from "@tour/ui";

import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";
import type { DenaliGatheringPickupStationFormValue } from "@/features/tours/wizard/schemas/denaliGatheringPickupStation.schema";

import { DenaliLocationPickerEditor } from "./DenaliLocationPickerEditor";
import { denaliLocationDataOrEmpty, EMPTY_DENALI_LOCATION } from "./denaliLocationFieldUtils";
import { useDenaliCanonicalOptional } from "../application";

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

function readGatheringPoints(
  getValues: (path: string) => unknown,
  name: string,
): DenaliGatheringPickupStationFormValue[] {
  const raw = getValues(name);
  return Array.isArray(raw) ? (raw as DenaliGatheringPickupStationFormValue[]) : [];
}

export function DenaliGatheringPointsWidget({ name }: DenaliGatheringPointsWidgetProps) {
  const t = useTranslations("tours.new.wizard.gatheringPoints");
  const tNew = useTranslations("tours.new");
  const { control, getValues, setValue, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const canonical = useDenaliCanonicalOptional();

  /** Push an explicit post-mutation snapshot (M7 — callers pass the updated array). */
  const syncGatheringPointsToCanonical = useCallback(
    (snapshot: DenaliGatheringPickupStationFormValue[]) => {
      canonical?.updateCanonical({ gatheringPoints: snapshot });
    },
    [canonical],
  );

  const rootError = readRhfErrorMessage(errors, name);

  const handleAdd = () => {
    const nextRow: DenaliGatheringPickupStationFormValue = {
      id: crypto.randomUUID(),
      title: "",
      time: "",
      location: { ...EMPTY_DENALI_LOCATION },
    };
    const next = [...readGatheringPoints(getValues, name), nextRow];
    append(nextRow);
    syncGatheringPointsToCanonical(next);
  };

  const handleRemove = (index: number) => {
    if (fields.length <= 1) {
      return;
    }
    const next = readGatheringPoints(getValues, name).filter((_, i) => i !== index);
    remove(index);
    syncGatheringPointsToCanonical(next);
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }} data-testid="denali-gathering-points-widget" data-field-path={name}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{t("title")}</h3>
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          {t("addButton")}
        </Button>
      </div>

      {rootError ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-600)" }}
          data-testid="denali-gathering-points-root-error"
        >
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>
          {t("emptyRequired")}
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
              border: "1px dashed var(--color-slate-200)",
              borderRadius: 6,
              padding: "0.75rem",
              margin: 0,
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 0.25rem" }}>
              {t("stationLegend", { index: index + 1 })}
            </legend>

            {stationError ? (
              <p
                role="alert"
                style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-600)" }}
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
              <FormField label={t("timeLabel")} style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name={`${name}.${index}.time`}
                  render={({ field: timeField }) => (
                    <JalaliTimePicker
                      value={timeField.value ?? ""}
                      onChange={(time) => {
                        const val = time || undefined;
                        timeField.onChange(val);
                        const rows = readGatheringPoints(getValues, name);
                        const next = rows.map((row, i) =>
                          i === index ? { ...row, time: val } : row,
                        );
                        syncGatheringPointsToCanonical(next);
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
                  style={{ color: "var(--color-danger-600)", height: "2.5rem" }}
                >
                  {t("removeStation")}
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
                    modalTitle={t("mapModalTitle", { index: index + 1 })}
                    value={locValue}
                    patch={(partial) => {
                      const nextLoc = {
                        ...EMPTY_DENALI_LOCATION,
                        ...locValue,
                        ...partial,
                      };
                      locationField.onChange(nextLoc);

                      const rows = readGatheringPoints(getValues, name);
                      const row = rows[index];
                      if (row == null) {
                        return;
                      }

                      const nextTitle =
                        partial.addressText !== undefined ? partial.addressText : row.title;
                      if (partial.addressText !== undefined) {
                        setValue(`${name}.${index}.title`, partial.addressText, {
                          shouldDirty: true,
                        });
                      }

                      const next = rows.map((r, i) =>
                        i === index ? { ...r, title: nextTitle, location: nextLoc } : r,
                      );
                      syncGatheringPointsToCanonical(next);
                    }}
                    searchLabel={t("searchLabel")}
                    searchHint={t("searchHint")}
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
