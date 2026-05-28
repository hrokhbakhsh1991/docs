"use client";

import { DENALI_LOCATION_ZONE_KEYS, type DenaliLocationZoneKey } from "@repo/types/denali";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Controller, useFormContext, type FieldPath } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliLogistics.schema";
import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DenaliLocationPickerEditor } from "./DenaliLocationPickerEditor";
import { denaliLocationDataOrEmpty, EMPTY_DENALI_LOCATION } from "./denaliLocationFieldUtils";
import { useDenaliCanonical } from "../application";
import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "../denaliFieldHints";

type DenaliLocationZoneFieldProps = {
  zoneKey: DenaliLocationZoneKey;
};

type DenaliLocationZoneFieldErrors =
  | {
      addressText?: { message?: string };
      latitude?: { message?: string };
      longitude?: { message?: string };
    }
  | undefined;

type DenaliLocationZoneEditorProps = {
  zoneKey: DenaliLocationZoneKey;
  value: DenaliLocationDataForm;
  onChange: (_next: DenaliLocationDataForm) => void;
  zoneErrors: DenaliLocationZoneFieldErrors;
};

function DenaliLocationZoneEditor({
  zoneKey,
  value,
  onChange,
  zoneErrors,
}: DenaliLocationZoneEditorProps) {
  const t = useTranslations("tours.denali");
  const { updateCanonical } = useDenaliCanonical();

  const patch = useCallback(
    (partial: Partial<DenaliLocationDataForm>) => {
      const next = { ...EMPTY_DENALI_LOCATION, ...value, ...partial };
      onChange(next);
      updateCanonical({ [zoneKey]: next });
    },
    [onChange, updateCanonical, value, zoneKey],
  );

  return (
    <DenaliLocationPickerEditor
      testIdKey={zoneKey}
      modalTitle={t("basic.locationZones.modalTitle", {
        zone: t(`basic.locationZones.${zoneKey}`),
      })}
      value={value}
      patch={patch}
      fieldErrors={zoneErrors}
    />
  );
}

export function DenaliLocationZonesSection() {
  const t = useTranslations("tours.denali");
  return (
    <details
      data-testid="denali-location-zones-section"
      style={{
        border: "1px solid var(--color-border-subtle, #e2e8f0)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
        {t("basic.locationZonesSection")}
      </summary>
      <p style={{ ...denaliFieldHintStyle, marginTop: "0.5rem" }} dir="rtl">
        {DENALI_FIELD_HINTS.locationZones}
      </p>
      <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.75rem" }}>
        {DENALI_LOCATION_ZONE_KEYS.map((zoneKey) => (
          <DenaliLocationZoneField key={zoneKey} zoneKey={zoneKey} />
        ))}
      </div>
    </details>
  );
}

export function DenaliLocationZoneField({ zoneKey }: DenaliLocationZoneFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    control,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const zoneErrors = errors.basicInfo?.[zoneKey as keyof typeof errors.basicInfo] as
    | {
        addressText?: { message?: string };
        latitude?: { message?: string };
        longitude?: { message?: string };
      }
    | undefined;
  const fieldPath = `basicInfo.${zoneKey}` as FieldPath<DenaliCreateTourWizardForm>;

  return (
    <fieldset
      data-testid={`denali-location-zone-${zoneKey}`}
      style={{
        border: "1px dashed var(--color-border-subtle, #e2e8f0)",
        borderRadius: 6,
        padding: "0.5rem 0.65rem",
        margin: 0,
      }}
    >
      <legend style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 0.25rem" }}>
        {t(`basic.locationZones.${zoneKey}`)}
      </legend>
      <Controller
        name={fieldPath}
        control={control}
        defaultValue={EMPTY_DENALI_LOCATION}
        render={({ field }) => (
          <DenaliLocationZoneEditor
            zoneKey={zoneKey}
            value={denaliLocationDataOrEmpty(field.value as DenaliLocationDataForm)}
            onChange={field.onChange}
            zoneErrors={zoneErrors}
          />
        )}
      />
    </fieldset>
  );
}
