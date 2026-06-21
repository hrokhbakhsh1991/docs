"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { DenaliTimeInput } from "../components/denali-time-input";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { normalizeApproximateReturnTime } from "../logic/denali-datetime-utils";

export const DENALI_RETURN_TIME_TEST_IDS = {
  returnTime: "denali-composite-approximate-return-time",
} as const;

type DenaliApproximateReturnTimeFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliApproximateReturnTimeField({
  draft,
  onDraftChange,
  required = false,
}: DenaliApproximateReturnTimeFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "approximateReturnTime");
  const value = normalizeApproximateReturnTime(
    getCanonicalStringValue(draft, "approximateReturnTime")
  );

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_RETURN_TIME_TEST_IDS.returnTime}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <DenaliTimeInput
          appearance="field"
          aria-label={label}
          value={value}
          onChange={(next) =>
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(
                base,
                "approximateReturnTime",
                normalizeApproximateReturnTime(next)
              )
            )
          }
          required={required}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.approximateReturn.helper")}</p>
    </div>
  );
}
