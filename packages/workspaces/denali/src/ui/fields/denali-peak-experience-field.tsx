"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Select, type SelectOption } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export const DENALI_MIN_REQUIRED_PEAKS_OPTIONS = [0, 1, 2, 3, 4] as const;

export const DENALI_PEAK_EXPERIENCE_TEST_IDS = {
  peakExperience: "denali-composite-peak-experience",
  select: "denali-composite-peak-experience-select",
} as const;

type DenaliPeakExperienceFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliPeakExperienceField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliPeakExperienceFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
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
    <div
      className="denali-wizard-composite"
      data-testid={DENALI_PEAK_EXPERIENCE_TEST_IDS.peakExperience}
      aria-invalid={invalid || undefined}
    >
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={options}
          value={value}
          onChange={(event) =>
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(base, "participants.minRequiredPeaks", event.target.value)
            )
          }
          required={required}
          aria-required={required || undefined}
          invalid={invalid}
          placeholder={t("composites.peakExperience.placeholder")}
          data-testid={DENALI_PEAK_EXPERIENCE_TEST_IDS.select}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.peakExperience.helper")}</p>
    </div>
  );
}
