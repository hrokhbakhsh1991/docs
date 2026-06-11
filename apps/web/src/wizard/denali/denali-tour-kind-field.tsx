"use client";

import React from "react";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel, resolveDenaliTourKindLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_TOUR_KIND_TEST_IDS = {
  tourKind: "denali-composite-tour-kind",
} as const;

type DenaliTourKindFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly tourKindValues: readonly string[];
  readonly required?: boolean;
};

export function DenaliTourKindField({
  draft,
  onDraftChange,
  tourKindValues,
  required = false,
}: DenaliTourKindFieldProps) {
  const t = useTranslations("denali");
  const value = getCanonicalStringValue(draft, "category");
  const label = resolveDenaliFieldLabel(t, "category");
  const options: readonly SelectOption[] = tourKindValues.map((tourKind) => ({
    value: tourKind,
    label: resolveDenaliTourKindLabel(t, tourKind),
  }));

  return (
    <div className="denali-wizard-composite denali-wizard-composite__field" data-testid={DENALI_TOUR_KIND_TEST_IDS.tourKind}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={options}
          value={value}
          onChange={(event) =>
            onDraftChange(setCanonicalStringValue(draft, "category", event.target.value))
          }
          required={required}
          aria-required={required || undefined}
          placeholder={t("composites.tourKind.placeholder")}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.tourKind.helper")}</p>
    </div>
  );
}
