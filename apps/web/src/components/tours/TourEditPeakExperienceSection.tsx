"use client";

import { Controller, type Control, type FieldErrors, type FieldPath } from "react-hook-form";

import { FormField, Select } from "@tour/ui";

import { PEAK_EXPERIENCE_MIN_OPTIONS } from "@/features/tours/domain/peak-experience";
import { DENALI_FIELD_HINTS } from "@/features/tours/wizard/denali/denaliFieldHints";

import type { TourFormInput } from "./tour-schema";

import styles from "./TourEditPeakExperienceSection.module.css";

type TourEditPeakExperienceSectionProps = {
  control: Control<TourFormInput>;
  errors: FieldErrors<TourFormInput>;
};

const fieldPath = "tripDetails.requirements.minRequiredPeaks" as FieldPath<TourFormInput>;

export function TourEditPeakExperienceSection({ control, errors }: TourEditPeakExperienceSectionProps) {
  const fieldError = errors.tripDetails?.requirements?.minRequiredPeaks?.message;

  return (
    <section
      className={styles.section}
      aria-labelledby="tour-edit-peak-experience-heading"
      data-testid="tour-edit-peak-experience-section"
    >
      <h3 id="tour-edit-peak-experience-heading" className={styles.heading}>
        تجربه قله‌ای (تایید خودکار مسافر)
      </h3>
      <FormField
        label="حداقل قله‌های صعودشده (شرط تایید خودکار)"
        description={DENALI_FIELD_HINTS.minRequiredPeaks}
        error={fieldError}
      >
        <Controller
          name={fieldPath}
          control={control}
          defaultValue={0}
          render={({ field }) => {
            const raw = field.value;
            const selected =
              typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 4
                ? String(raw)
                : "0";
            return (
              <Select
                data-testid="tour-field-min-required-peaks"
                value={selected}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  field.onChange(Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                onBlur={field.onBlur}
                name={field.name}
              >
                {PEAK_EXPERIENCE_MIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            );
          }}
        />
      </FormField>
    </section>
  );
}
