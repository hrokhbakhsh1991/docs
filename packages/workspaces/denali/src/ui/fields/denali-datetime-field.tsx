"use client";

import { useTranslations } from "next-intl";

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

type DenaliDatetimeFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
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
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, canonicalPath);
  const stored = getCanonicalStringValue(draft, canonicalPath);
  const localValue = isoToDatetimeLocalInput(stored);

  return (
    <div className="denali-wizard-composite" data-testid={testId} data-wizard-date-picker>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <DenaliWizardDatetimePicker
          aria-label={label}
          value={localValue}
          onChange={(local) =>
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(base, canonicalPath, datetimeLocalInputToIso(local))
            )
          }
          required={required}
        />
      </label>
      {hint ? <p className="denali-wizard-composite__helper">{hint}</p> : null}
    </div>
  );
}

export { DENALI_DATETIME_TEST_IDS } from "../test-ids/denali-datetime-test-ids";
