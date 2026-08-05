"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { PrimitiveLocalizedNumericInput } from "../components/localized-numeric-input";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export const DENALI_ELEVATION_TEST_IDS = {
  elevationGain: "denali-composite-elevation-gain",
} as const;

type DenaliElevationGainFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliElevationGainField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
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
          invalid={invalid}
          placeholder={t("composites.elevation.meters")}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.elevation.helper")}</p>
    </div>
  );
}
