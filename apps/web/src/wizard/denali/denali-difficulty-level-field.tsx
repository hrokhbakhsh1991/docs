"use client";

import React, { useMemo } from "react";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_DIFFICULTY_TEST_IDS = {
  difficulty: "denali-composite-difficulty",
} as const;

type DenaliDifficultyLevelFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliDifficultyLevelField({
  draft,
  onDraftChange,
  required = false,
}: DenaliDifficultyLevelFieldProps) {
  const t = useTranslations("denali");
  const label = resolveDenaliFieldLabel(t, "program.difficultyLevel");
  const raw = getCanonicalStringValue(draft, "program.difficultyLevel");
  const value = raw.trim().length > 0 ? raw : "5";
  const difficultyOptions: readonly SelectOption[] = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const level = index + 1;
        return {
          value: String(level),
          label: t("composites.difficulty.level", { level }),
        };
      }),
    [t]
  );

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_DIFFICULTY_TEST_IDS.difficulty}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={difficultyOptions}
          value={value}
          onChange={(event) =>
            onDraftChange(setCanonicalStringValue(draft, "program.difficultyLevel", event.target.value))
          }
          required={required}
          aria-required={required || undefined}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.difficulty.helper")}</p>
    </div>
  );
}
