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

export const DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_OPTIONS = [1, 2, 3] as const;

export const DENALI_RECENT_TOUR_AUTO_APPROVE_TEST_IDS = {
  root: "denali-composite-recent-tour-auto-approve",
  select: "denali-composite-recent-tour-auto-approve-select",
} as const;

type DenaliRecentTourAutoApproveFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliRecentTourAutoApproveField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliRecentTourAutoApproveFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "participants.autoApproveMinRecentTours");
  const rawValue = getCanonicalStringValue(draft, "participants.autoApproveMinRecentTours").trim();
  const value = DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_OPTIONS.some(
    (option) => String(option) === rawValue
  )
    ? rawValue
    : "";
  const options: readonly SelectOption[] = DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_OPTIONS.map(
    (option) => ({
      value: String(option),
      label: t(`composites.recentTourAutoApprove.options.${option}`),
    })
  );

  return (
    <div
      className="denali-wizard-composite"
      data-testid={DENALI_RECENT_TOUR_AUTO_APPROVE_TEST_IDS.root}
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
              setCanonicalStringValue(
                base,
                "participants.autoApproveMinRecentTours",
                event.target.value
              )
            )
          }
          required={required}
          aria-required={required || undefined}
          invalid={invalid}
          placeholder={t("composites.recentTourAutoApprove.placeholder")}
          data-testid={DENALI_RECENT_TOUR_AUTO_APPROVE_TEST_IDS.select}
        />
      </label>
      <p className="denali-wizard-composite__helper">
        {t("composites.recentTourAutoApprove.helper")}
      </p>
    </div>
  );
}
