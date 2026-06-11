"use client";

import React from "react";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_MIN_REQUIRED_PEAKS_OPTIONS = [0, 1, 2, 3, 4] as const;

export const DENALI_PEAK_EXPERIENCE_TEST_IDS = {
  peakExperience: "denali-composite-peak-experience",
  select: "denali-composite-peak-experience-select",
} as const;

type DenaliPeakExperienceFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliPeakExperienceField({
  draft,
  onDraftChange,
  required = false,
}: DenaliPeakExperienceFieldProps) {
  const t = useTranslations("denali");
  const label = resolveDenaliFieldLabel(t, "participants.minRequiredPeaks");
  const rawValue = getCanonicalStringValue(draft, "participants.minRequiredPeaks").trim();
  const value = DENALI_MIN_REQUIRED_PEAKS_OPTIONS.some((option) => String(option) === rawValue)
    ? rawValue
    : "";
  const options: readonly SelectOption[] = DENALI_MIN_REQUIRED_PEAKS_OPTIONS.map((option) => ({
    value: String(option),
    label: t(`composites.peakExperience.options.${option}`),
  }));

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_PEAK_EXPERIENCE_TEST_IDS.peakExperience}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={options}
          value={value}
          onChange={(event) =>
            onDraftChange(
              setCanonicalStringValue(draft, "participants.minRequiredPeaks", event.target.value)
            )
          }
          required={required}
          aria-required={required || undefined}
          placeholder={t("composites.peakExperience.placeholder")}
          data-testid={DENALI_PEAK_EXPERIENCE_TEST_IDS.select}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.peakExperience.helper")}</p>
    </div>
  );
}
