"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Select } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export const DENALI_PUBLISH_STATUS_TEST_IDS = {
  field: "denali-review-publish-status",
} as const;

const PUBLISH_STATUS_VALUES = ["draft", "active"] as const;

type DenaliPublishStatusFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
};

export function DenaliPublishStatusField({ draft, onDraftChange }: DenaliPublishStatusFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "publishStatus");
  const value = getCanonicalStringValue(draft, "publishStatus") || "draft";

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_PUBLISH_STATUS_TEST_IDS.field}>
      <label className="denali-wizard-composite__label" htmlFor="denali-publish-status">
        {label}
      </label>
      <Select
        id="denali-publish-status"
        value={value}
        options={PUBLISH_STATUS_VALUES.map((status) => ({
          value: status,
          label:
            status === "draft"
              ? t("review.publishStatus.draft")
              : t("review.publishStatus.active"),
        }))}
        onChange={(event) =>
          commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
            setCanonicalStringValue(base, "publishStatus", event.target.value)
          )
        }
      />
      <p className="denali-wizard-composite__helper">{t("review.publishStatus.helper")}</p>
    </div>
  );
}
