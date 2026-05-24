"use client";

import type { DenaliLocationZoneKey } from "@repo/types/denali";
import { useTranslations } from "next-intl";
import { Controller, type Control, type FieldErrors, type FieldPath } from "react-hook-form";

import { DenaliLocationPickerEditor } from "@/features/tours/wizard/denali/components/DenaliLocationPickerEditor";
import {
  denaliLocationDataOrEmpty,
  EMPTY_DENALI_LOCATION,
} from "@/features/tours/wizard/denali/components/denaliLocationFieldUtils";
import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

import { DENALI_FIELD_HINTS } from "@/features/tours/wizard/denali/denaliFieldHints";

import type { TourFormInput } from "./tour-schema";

import styles from "./TourEditDenaliGeoSection.module.css";

const PUBLISH_GEO_ZONE_KEYS = ["startPoint"] as const satisfies readonly DenaliLocationZoneKey[];

type TourEditDenaliGeoSectionProps = {
  control: Control<TourFormInput>;
  errors: FieldErrors<TourFormInput>;
};

type ZoneEditorProps = {
  zoneKey: (typeof PUBLISH_GEO_ZONE_KEYS)[number];
  control: Control<TourFormInput>;
  zoneErrors: DenaliLocationZoneFieldErrors;
};

type DenaliLocationZoneFieldErrors =
  | {
      addressText?: { message?: string };
      latitude?: { message?: string };
      longitude?: { message?: string };
    }
  | undefined;

function TourEditDenaliLocationZone({ zoneKey, control, zoneErrors }: ZoneEditorProps) {
  const t = useTranslations("tours.denali");
  const fieldPath = `tripDetails.overview.${zoneKey}` as FieldPath<TourFormInput>;

  return (
    <fieldset
      className={styles.zoneFieldset}
      data-testid={`tour-edit-denali-zone-${zoneKey}`}
      data-field-path={fieldPath}
    >
      <legend className={styles.zoneLegend}>{t(`basic.locationZones.${zoneKey}`)}</legend>
      <Controller
        name={fieldPath}
        control={control}
        defaultValue={EMPTY_DENALI_LOCATION}
        render={({ field }) => {
          const value = denaliLocationDataOrEmpty(field.value as DenaliLocationDataForm | undefined);
          return (
            <DenaliLocationPickerEditor
              testIdKey={`edit-${zoneKey}`}
              modalTitle={t("basic.locationZones.modalTitle", {
                zone: t(`basic.locationZones.${zoneKey}`),
              })}
              value={value}
              patch={(partial) => {
                field.onChange({ ...EMPTY_DENALI_LOCATION, ...value, ...partial });
              }}
              fieldErrors={zoneErrors}
            />
          );
        }}
      />
    </fieldset>
  );
}

/** Publish-required Denali pins for classic edit (`overview.gatheringPoint` / `startPoint`). */
export function TourEditDenaliGeoSection({ control, errors }: TourEditDenaliGeoSectionProps) {
  const overviewErrors = errors.tripDetails?.overview;
  const overviewRecord =
    overviewErrors && typeof overviewErrors === "object" && !("message" in overviewErrors)
      ? (overviewErrors as Record<string, DenaliLocationZoneFieldErrors>)
      : undefined;

  return (
    <section
      className={styles.section}
      aria-labelledby="tour-edit-denali-geo-heading"
      data-testid="tour-edit-denali-geo-section"
    >
      <h3 id="tour-edit-denali-geo-heading" className={styles.heading}>
        مختصات و نقاط جغرافیایی تور
      </h3>
      <p className={styles.hint} dir="rtl">
        {DENALI_FIELD_HINTS.locationZones}
      </p>
      <div className={styles.zones}>
        {PUBLISH_GEO_ZONE_KEYS.map((zoneKey) => (
          <TourEditDenaliLocationZone
            key={zoneKey}
            zoneKey={zoneKey}
            control={control}
            zoneErrors={overviewRecord?.[zoneKey]}
          />
        ))}
      </div>
    </section>
  );
}
