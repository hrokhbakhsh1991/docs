"use client";

import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_PUBLISH_STATUS_TEST_IDS = {
  field: "denali-review-publish-status",
} as const;

const PUBLISH_STATUS_VALUES = ["draft", "active"] as const;

type DenaliPublishStatusFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

export function DenaliPublishStatusField({ draft, onDraftChange }: DenaliPublishStatusFieldProps) {
  const t = useTranslations("denali");
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
        options={PUBLISH_STATUS_VALUES.map((value) => ({
          value,
          label:
            value === "draft"
              ? t("review.publishStatus.draft")
              : t("review.publishStatus.active"),
        }))}
        onChange={(event) =>
          onDraftChange(setCanonicalStringValue(draft, "publishStatus", event.target.value))
        }
      />
      <p className="denali-wizard-composite__helper">{t("review.publishStatus.helper")}</p>
    </div>
  );
}
