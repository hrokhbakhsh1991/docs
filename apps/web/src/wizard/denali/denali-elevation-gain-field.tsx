"use client";

import React from "react";
import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

export const DENALI_ELEVATION_TEST_IDS = {
  elevationGain: "denali-composite-elevation-gain",
} as const;

type DenaliElevationGainFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliElevationGainField({
  draft,
  onDraftChange,
  required = false,
}: DenaliElevationGainFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "tripDetails.metrics.elevationGain");

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_ELEVATION_TEST_IDS.elevationGain}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <PrimitiveLocalizedNumericInput
          mode="digits"
          aria-label={label}
          value={getCanonicalStringValue(draft, "tripDetails.metrics.elevationGain")}
          onChange={(value) =>
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(base, "tripDetails.metrics.elevationGain", value)
            )
          }
          required={required}
          aria-required={required || undefined}
          placeholder={t("composites.elevation.meters")}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.elevation.helper")}</p>
    </div>
  );
}
