"use client";

import React from "react";
import { useTranslations } from "next-intl";

import { LocalizedDatetimePicker } from "@/components/i18n/localized-datetime-picker";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { datetimeLocalInputToIso, isoToDatetimeLocalInput } from "./denali-datetime-utils";

export const DENALI_DATETIME_TEST_IDS = {
  start: "denali-composite-datetime-start",
  end: "denali-composite-datetime-end",
} as const;

type DenaliDatetimeFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly testId?: string;
  readonly hint?: string;
};

export function DenaliDatetimeField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
  testId,
  hint,
}: DenaliDatetimeFieldProps) {
  const t = useTranslations("denali");
  const label = resolveDenaliFieldLabel(t, canonicalPath);
  const stored = getCanonicalStringValue(draft, canonicalPath);
  const localValue = isoToDatetimeLocalInput(stored);

  return (
    <div className="denali-wizard-composite" data-testid={testId} data-wizard-date-picker>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <LocalizedDatetimePicker
          layout="wizard"
          aria-label={label}
          value={localValue}
          onChange={(local) =>
            onDraftChange(
              setCanonicalStringValue(draft, canonicalPath, datetimeLocalInputToIso(local))
            )
          }
          required={required}
        />
      </label>
      {hint ? <p className="denali-wizard-composite__helper">{hint}</p> : null}
    </div>
  );
}
