"use client";

import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "@app-tour/workspace-denali/plugin";
import React, { useMemo } from "react";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import {
  DENALI_EVENT_VARIANT_VALUES,
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  denaliCategoryRequiresEventVariant,
  type DenaliEventVariantSlug,
  type DenaliTourCategorySlug,
  type DenaliTourDurationSlug,
} from "./denali-tour-kind-labels";
import { DENALI_TOUR_KIND_TEST_IDS } from "./denali-tour-kind-test-ids";

export { DENALI_TOUR_KIND_TEST_IDS } from "./denali-tour-kind-test-ids";

type DenaliTourKindFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

function readTourKindSlug(draft: TourWizardDraft): string {
  return getCanonicalStringValue(draft, "category").trim();
}

export function DenaliTourKindField({
  draft,
  onDraftChange,
  required = false,
}: DenaliTourKindFieldProps) {
  const t = useTranslations("denali");
  const tourKindSlug = readTourKindSlug(draft);
  const basics = useMemo(
    () =>
      readDenaliCanonicalBasics(tourKindSlug.length > 0 ? tourKindSlug : undefined) ?? {
        category: "mountain" as DenaliTourCategorySlug,
        duration: "single_day" as DenaliTourDurationSlug,
      },
    [tourKindSlug]
  );

  const categoryLabel = resolveDenaliFieldLabel(t, "category");
  const durationLabel = resolveDenaliFieldLabel(t, "duration");
  const eventVariantLabel = resolveDenaliFieldLabel(t, "eventVariant");

  const applyPatch = (patch: {
    category?: DenaliTourCategorySlug;
    duration?: DenaliTourDurationSlug;
    eventVariant?: DenaliEventVariantSlug;
  }) => {
    const nextSlug = patchDenaliCanonicalBasics(
      tourKindSlug.length > 0 ? tourKindSlug : undefined,
      patch
    );
    onDraftChange(setCanonicalStringValue(draft, "category", nextSlug));
  };

  const showEventVariant = denaliCategoryRequiresEventVariant(basics.category);

  return (
    <div
      className="denali-wizard-composite denali-tour-kind"
      data-denali-tour-kind
      data-testid={DENALI_TOUR_KIND_TEST_IDS.tourKind}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{categoryLabel}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.tourKind.helper")}</p>
      </div>

      <fieldset className="denali-tour-kind__group">
        <legend className="denali-tour-kind__legend">{categoryLabel}</legend>
        <div className="denali-tour-kind__choices" role="group" aria-label={categoryLabel}>
          {DENALI_TOUR_CATEGORY_VALUES.map((category) => (
            <button
              key={category}
              type="button"
              className={
                basics.category === category
                  ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                  : "denali-tour-kind__choice"
              }
              data-testid={DENALI_TOUR_KIND_TEST_IDS.category(category)}
              aria-pressed={basics.category === category}
              aria-required={required || undefined}
              onClick={() => {
                if (basics.category === category) {
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
                basics.duration === duration
                  ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                  : "denali-tour-kind__choice"
              }
              data-testid={DENALI_TOUR_KIND_TEST_IDS.duration(duration)}
              aria-pressed={basics.duration === duration}
              aria-required={required || undefined}
              onClick={() => {
                if (basics.duration === duration) {
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
                  basics.eventVariant === eventVariant
                    ? "denali-tour-kind__choice denali-tour-kind__choice--active"
                    : "denali-tour-kind__choice"
                }
                data-testid={DENALI_TOUR_KIND_TEST_IDS.eventVariant(eventVariant)}
                aria-pressed={basics.eventVariant === eventVariant}
                aria-required={required || undefined}
                onClick={() => {
                  if (basics.eventVariant === eventVariant) {
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
  );
}
