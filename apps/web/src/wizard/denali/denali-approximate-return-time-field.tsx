"use client";

import React from "react";
import { useTranslations } from "next-intl";

import { LocalizedTimeInput } from "@/components/i18n/localized-datetime-picker";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { normalizeApproximateReturnTime } from "./denali-datetime-utils";

export const DENALI_RETURN_TIME_TEST_IDS = {
  returnTime: "denali-composite-approximate-return-time",
} as const;

type DenaliApproximateReturnTimeFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliApproximateReturnTimeField({
  draft,
  onDraftChange,
  required = false,
}: DenaliApproximateReturnTimeFieldProps) {
  const t = useTranslations("denali");
  const label = resolveDenaliFieldLabel(t, "approximateReturnTime");
  const value = normalizeApproximateReturnTime(
    getCanonicalStringValue(draft, "approximateReturnTime")
  );

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_RETURN_TIME_TEST_IDS.returnTime}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <LocalizedTimeInput
          variant="primitive"
          aria-label={label}
          value={value}
          onChange={(next) =>
            onDraftChange(
              setCanonicalStringValue(draft, "approximateReturnTime", normalizeApproximateReturnTime(next))
            )
          }
          required={required}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.approximateReturn.helper")}</p>
    </div>
  );
}
