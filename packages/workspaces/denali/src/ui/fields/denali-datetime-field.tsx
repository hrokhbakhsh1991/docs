"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { DenaliWizardDatetimePicker } from "../components/localized-datetime-picker";
import {
  datetimeLocalInputToIso,
  isoToDatetimeLocalInput,
} from "../logic/denali-datetime-utils";
import { resolveDenaliDatetimeFieldMinIsoDate } from "../logic/denali-schedule-date-policy";

type DenaliDatetimeFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly testId?: string;
  readonly hint?: string;
  readonly invalid?: boolean;
};

export function DenaliDatetimeField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
  testId,
  hint,
  invalid = false,
}: DenaliDatetimeFieldProps) {
  const t = useTranslations("denali");
  const fieldId = useId();
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, canonicalPath);
  const stored = getCanonicalStringValue(draft, canonicalPath);
  const localValue = isoToDatetimeLocalInput(stored);
  const minIsoDate = resolveDenaliDatetimeFieldMinIsoDate(canonicalPath);

  return (
    <div className="denali-wizard-composite" data-testid={testId} data-wizard-date-picker>
      <div className="denali-wizard-composite__field">
        <label htmlFor={fieldId}>{label}</label>
        <DenaliWizardDatetimePicker
          id={fieldId}
          aria-label={label}
          value={localValue}
          minIsoDate={minIsoDate}
          onChange={(local) =>
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(base, canonicalPath, datetimeLocalInputToIso(local))
            )
          }
          required={required}
          invalid={invalid}
        />
      </div>
      {hint ? <p className="denali-wizard-composite__helper">{hint}</p> : null}
    </div>
  );
}

export { DENALI_DATETIME_TEST_IDS } from "../test-ids/denali-datetime-test-ids";
