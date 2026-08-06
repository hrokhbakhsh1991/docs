"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import type { AppLocale } from "../adapters/i18n-format";
import { DenaliDifficultyRangeSlider } from "../adapters/ui-primitives";
import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import {
  DIFFICULTY_LEVEL_MAX,
  DIFFICULTY_LEVEL_MIN,
  DIFFICULTY_LEVEL_SLIDER_UNSET_POSITION,
  DIFFICULTY_LEVEL_STEP,
  difficultyLevelSliderProgress,
  formatDifficultyLevelDisplay,
  formatDifficultyLevelStorage,
  parseDifficultyLevel,
} from "../logic/denali-difficulty-level-logic";

export const DENALI_DIFFICULTY_TEST_IDS = {
  difficulty: "denali-composite-difficulty",
  slider: "denali-difficulty-slider",
  value: "denali-difficulty-value",
} as const;

type DenaliDifficultyLevelFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliDifficultyLevelField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliDifficultyLevelFieldProps) {
  const t = useTranslations("denali");
  const locale = useLocale() as AppLocale;
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "program.difficultyLevel");
  const raw = getCanonicalStringValue(draft, "program.difficultyLevel");
  const value = useMemo(() => parseDifficultyLevel(raw), [raw]);
  const isUnset = value == null;
  const sliderValue = value ?? DIFFICULTY_LEVEL_SLIDER_UNSET_POSITION;
  const displayValue = isUnset
    ? t("composites.difficulty.unset")
    : formatDifficultyLevelDisplay(value, locale);
  const minLabel = formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MIN, locale);
  const maxLabel = formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MAX, locale);
  const sliderProgress = difficultyLevelSliderProgress(sliderValue);

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
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "program.difficultyLevel", formatDifficultyLevelStorage(next))
    );
  };

  const commitFromSliderEvent = (event: { readonly currentTarget: HTMLInputElement }) => {
    commitValue(Number.parseFloat(event.currentTarget.value));
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-operator-difficulty-level
      data-difficulty-unset={isUnset ? "true" : undefined}
      data-testid={DENALI_DIFFICULTY_TEST_IDS.difficulty}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.difficulty.helper")}</p>
      </div>

      <div className="denali-difficulty-level__panel">
        <output
          className={
            isUnset
              ? "denali-difficulty-level__value denali-difficulty-level__value--unset"
              : "denali-difficulty-level__value"
          }
          data-testid={DENALI_DIFFICULTY_TEST_IDS.value}
          htmlFor={DENALI_DIFFICULTY_TEST_IDS.slider}
        >
          {displayValue}
          {isUnset ? null : (
            <>
              {" "}
              <span className="denali-difficulty-level__value-suffix">
                {t("composites.difficulty.outOf", {
                  max: formatDifficultyLevelDisplay(DIFFICULTY_LEVEL_MAX, locale),
                })}
              </span>
            </>
          )}
        </output>

        <div className="denali-difficulty-level__slider-wrap">
          <div className="denali-difficulty-level__track" aria-hidden>
            <div
              className="denali-difficulty-level__fill"
              style={{ width: isUnset ? "0%" : `${sliderProgress}%` }}
            />
          </div>
          <DenaliDifficultyRangeSlider
            id={DENALI_DIFFICULTY_TEST_IDS.slider}
            className="denali-difficulty-level__slider"
            data-testid={DENALI_DIFFICULTY_TEST_IDS.slider}
            min={DIFFICULTY_LEVEL_MIN}
            max={DIFFICULTY_LEVEL_MAX}
            step={DIFFICULTY_LEVEL_STEP}
            value={sliderValue}
            required={required}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-label={label}
            aria-valuemin={DIFFICULTY_LEVEL_MIN}
            aria-valuemax={DIFFICULTY_LEVEL_MAX}
            aria-valuenow={isUnset ? undefined : value}
            aria-valuetext={displayValue}
            onInput={commitFromSliderEvent}
            onChange={commitFromSliderEvent}
            onPointerUp={(event) => {
              // Controlled unset parks at UNSET_POSITION; browsers often skip `change` when
              // the value does not move — still treat the gesture as an operator choice.
              if (isUnset) {
                commitFromSliderEvent(event);
              }
            }}
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
