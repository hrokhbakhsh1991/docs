"use client";

import { patchDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import { useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import {
  DENALI_EVENT_VARIANT_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  denaliCategoryRequiresEventVariant,
  type DenaliEventVariantSlug,
  type DenaliTourCategorySlug,
  type DenaliTourDurationSlug,
} from "../logic/denali-tour-kind-labels";
import { resolveDenaliWizardCategoryChoices } from "../logic/denali-wizard-launch-profile";
import { DENALI_TOUR_KIND_TEST_IDS } from "../test-ids/denali-tour-kind-test-ids";
import {
  isDenaliTourKindChoiceActive,
  rebaseCategoryDraftChange,
  resolveDenaliTourKindSummaryParts,
  resolveDenaliTourKindUiBasics,
} from "../logic/denali-tour-kind-field-logic";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export { DENALI_TOUR_KIND_TEST_IDS } from "../test-ids/denali-tour-kind-test-ids";

type DenaliTourKindFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

function readTourKindSlug(draft: DenaliTourWizardDraft): string {
  return getCanonicalStringValue(draft, "category").trim();
}

export function DenaliTourKindField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliTourKindFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const tourKindSlug = readTourKindSlug(draft);
  const tourKindSlugRef = useRef(tourKindSlug);
  tourKindSlugRef.current = tourKindSlug;

  const { hasSelection, basics } = useMemo(
    () => resolveDenaliTourKindUiBasics(tourKindSlug),
    [tourKindSlug]
  );

  const categoryLabel = resolveDenaliFieldLabel(t, "category");
  const durationLabel = resolveDenaliFieldLabel(t, "duration");
  const eventVariantLabel = resolveDenaliFieldLabel(t, "eventVariant");

  const summaryParts = useMemo(() => resolveDenaliTourKindSummaryParts(basics), [basics]);

  const summaryText = useMemo(() => {
    if (!hasSelection || basics == null) {
      return null;
    }
    return summaryParts
      .map((part) => {
        if (part === "category") {
          return t(`composites.tourKind.categories.${basics.category}`);
        }
        if (part === "duration") {
          return t(`composites.tourKind.durations.${basics.duration}`);
        }
        return t(`composites.tourKind.eventVariants.${basics.eventVariant!}`);
      })
      .join(" · ");
  }, [basics, hasSelection, summaryParts, t]);

  const applyPatch = useCallback(
    (patch: {
      category?: DenaliTourCategorySlug;
      duration?: DenaliTourDurationSlug;
      eventVariant?: DenaliEventVariantSlug;
    }) => {
      const currentSlug = tourKindSlugRef.current;
      const nextSlug = patchDenaliCanonicalBasics(
        (currentSlug.length > 0 ? currentSlug : undefined) as Parameters<
          typeof patchDenaliCanonicalBasics
        >[0],
        patch
      );
      tourKindSlugRef.current = nextSlug;
      commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
        rebaseCategoryDraftChange(base, nextSlug)
      );
    },
    [draftRef, onDraftChange]
  );

  const wizardCategoryChoices = useMemo(() => resolveDenaliWizardCategoryChoices(), []);

  const showEventVariant =
    basics != null && denaliCategoryRequiresEventVariant(basics.category);

  return (
    <div
      className="denali-wizard-composite denali-tour-kind"
      data-operator-tour-kind
      data-testid={DENALI_TOUR_KIND_TEST_IDS.tourKind}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{categoryLabel}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.tourKind.helper")}</p>
        {summaryText != null ? (
          <p
            className="denali-tour-kind__current"
            data-testid={DENALI_TOUR_KIND_TEST_IDS.summary}
            aria-live="polite"
          >
            <span className="denali-tour-kind__current-label">{t("composites.tourKind.currentLabel")}</span>
            <span className="denali-tour-kind__current-value">{summaryText}</span>
          </p>
        ) : (
          <p className="denali-tour-kind__prompt" data-testid={DENALI_TOUR_KIND_TEST_IDS.summary}>
            {t("composites.tourKind.placeholder")}
          </p>
        )}
      </div>

      <div className="denali-tour-kind__picker" data-testid={DENALI_TOUR_KIND_TEST_IDS.picker}>
        <fieldset className="denali-tour-kind__group">
          <legend className="denali-tour-kind__legend">{categoryLabel}</legend>
          <div
            className="denali-tour-kind__choices"
            role="group"
            aria-label={categoryLabel}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
          >
            {wizardCategoryChoices.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  isDenaliTourKindChoiceActive(hasSelection, basics?.category, category)
                    ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                    : "denali-tour-kind__choice"
                }
                data-testid={DENALI_TOUR_KIND_TEST_IDS.category(category)}
                aria-pressed={isDenaliTourKindChoiceActive(hasSelection, basics?.category, category)}
                aria-required={required || undefined}
                onClick={() => {
                  if (isDenaliTourKindChoiceActive(hasSelection, basics?.category, category)) {
                    return;
                  }
                  applyPatch({ category });
                }}
              >
                {t(`composites.tourKind.categories.${category}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="denali-tour-kind__group">
          <legend className="denali-tour-kind__legend">{durationLabel}</legend>
          <div className="denali-tour-kind__choices" role="group" aria-label={durationLabel}>
            {DENALI_TOUR_DURATION_VALUES.map((duration) => (
              <button
                key={duration}
                type="button"
                className={
                  isDenaliTourKindChoiceActive(hasSelection, basics?.duration, duration)
                    ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                    : "denali-tour-kind__choice"
                }
                data-testid={DENALI_TOUR_KIND_TEST_IDS.duration(duration)}
                aria-pressed={isDenaliTourKindChoiceActive(hasSelection, basics?.duration, duration)}
                aria-required={required || undefined}
                onClick={() => {
                  if (isDenaliTourKindChoiceActive(hasSelection, basics?.duration, duration)) {
                    return;
                  }
                  applyPatch({ duration });
                }}
              >
                {t(`composites.tourKind.durations.${duration}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {showEventVariant ? (
          <fieldset className="denali-tour-kind__group">
            <legend className="denali-tour-kind__legend">{eventVariantLabel}</legend>
            <div className="denali-tour-kind__choices" role="group" aria-label={eventVariantLabel}>
              {DENALI_EVENT_VARIANT_VALUES.map((eventVariant) => (
                <button
                  key={eventVariant}
                  type="button"
                  className={
                    isDenaliTourKindChoiceActive(hasSelection, basics?.eventVariant, eventVariant)
                      ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                      : "denali-tour-kind__choice"
                  }
                  data-testid={DENALI_TOUR_KIND_TEST_IDS.eventVariant(eventVariant)}
                  aria-pressed={isDenaliTourKindChoiceActive(
                    hasSelection,
                    basics?.eventVariant,
                    eventVariant
                  )}
                  aria-required={required || undefined}
                  onClick={() => {
                    if (
                      isDenaliTourKindChoiceActive(hasSelection, basics?.eventVariant, eventVariant)
                    ) {
                      return;
                    }
                    applyPatch({ eventVariant });
                  }}
                >
                  {t(`composites.tourKind.eventVariants.${eventVariant}`)}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
