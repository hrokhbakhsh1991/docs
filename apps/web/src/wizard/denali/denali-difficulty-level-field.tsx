"use client";

import React, { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { AppLocale } from "@/i18n/routing";
import { DenaliDifficultyRangeSlider } from "@/components/ui/denali-difficulty-range-slider";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import {
  DIFFICULTY_LEVEL_MAX,
  DIFFICULTY_LEVEL_MIN,
  DIFFICULTY_LEVEL_STEP,
  difficultyLevelSliderProgress,
  formatDifficultyLevelDisplay,
  formatDifficultyLevelStorage,
  parseDifficultyLevel,
} from "./denali-difficulty-level-logic";

export const DENALI_DIFFICULTY_TEST_IDS = {
  difficulty: "denali-composite-difficulty",
  slider: "denali-difficulty-slider",
  value: "denali-difficulty-value",
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
  const locale = useLocale() as AppLocale;
  const label = resolveDenaliFieldLabel(t, "program.difficultyLevel");
  const raw = getCanonicalStringValue(draft, "program.difficultyLevel");
  const value = useMemo(() => parseDifficultyLevel(raw), [raw]);
  const displayValue = formatDifficultyLevelDisplay(value, locale);
  const minLabel = formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MIN, locale);
  const maxLabel = formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MAX, locale);
  const sliderProgress = difficultyLevelSliderProgress(value);

  const integerTicks = useMemo(
    () =>
      Array.from({ length: DIFFICULTY_LEVEL_MAX - DIFFICULTY_LEVEL_MIN + 1 }, (_, index) => {
        const level = DIFFICULTY_LEVEL_MIN + index;
        return {
          level,
          label: formatDifficultyLevelDisplay(level, locale),
        };
      }),
    [locale]
  );

  const commitValue = (next: number) => {
    onDraftChange(
      setCanonicalStringValue(draft, "program.difficultyLevel", formatDifficultyLevelStorage(next))
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-difficulty-level
      data-testid={DENALI_DIFFICULTY_TEST_IDS.difficulty}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.difficulty.helper")}</p>
      </div>

      <div className="denali-difficulty-level__panel">
        <output
          className="denali-difficulty-level__value"
          data-testid={DENALI_DIFFICULTY_TEST_IDS.value}
          htmlFor={DENALI_DIFFICULTY_TEST_IDS.slider}
        >
          {displayValue}
          <span className="denali-difficulty-level__value-suffix">
            {t("composites.difficulty.outOf", {
              max: formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MAX, locale),
            })}
          </span>
        </output>

        <div className="denali-difficulty-level__slider-wrap">
          <div className="denali-difficulty-level__track" aria-hidden>
            <div
              className="denali-difficulty-level__fill"
              style={{ width: `${sliderProgress}%` }}
            />
          </div>
          <DenaliDifficultyRangeSlider
            id={DENALI_DIFFICULTY_TEST_IDS.slider}
            className="denali-difficulty-level__slider"
            data-testid={DENALI_DIFFICULTY_TEST_IDS.slider}
            min={DIFFICULTY_LEVEL_MIN}
            max={DIFFICULTY_LEVEL_MAX}
            step={DIFFICULTY_LEVEL_STEP}
            value={value}
            required={required}
            aria-required={required || undefined}
            aria-label={label}
            aria-valuemin={DIFFICULTY_LEVEL_MIN}
            aria-valuemax={DIFFICULTY_LEVEL_MAX}
            aria-valuenow={value}
            aria-valuetext={displayValue}
            onChange={(event) => commitValue(Number.parseFloat(event.target.value))}
            onInput={(event) =>
              commitValue(Number.parseFloat((event.target as HTMLInputElement).value))
            }
          />
          <div className="denali-difficulty-level__scale" aria-hidden>
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
          <div className="denali-difficulty-level__ticks" aria-hidden>
            {integerTicks.map((tick) => (
              <span
                key={tick.level}
                className="denali-difficulty-level__tick"
                style={{
                  insetInlineStart: `${difficultyLevelSliderProgress(tick.level)}%`,
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
