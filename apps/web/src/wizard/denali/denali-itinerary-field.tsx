"use client";

import React, { useMemo } from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import {
  buildDefaultItineraryDays,
  parseDenaliItineraryDays,
  type DenaliItineraryDay,
} from "./denali-itinerary-types";
import { estimateDenaliTourDayCount } from "./denali-photo-types";

export const DENALI_ITINERARY_TEST_IDS = {
  itinerary: "denali-composite-itinerary",
} as const;

type DenaliItineraryFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliItineraryField({
  draft,
  onDraftChange,
  required = false,
}: DenaliItineraryFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const label = resolveDenaliFieldLabel(t, "program.itinerary");
  const stored = parseDenaliItineraryDays(getCanonicalValue(draft, "program.itinerary"));

  const targetDayCount = useMemo(() => {
    return (
      estimateDenaliTourDayCount(
        getCanonicalStringValue(draft, "startDateTime"),
        getCanonicalStringValue(draft, "endDateTime")
      ) ?? Math.max(stored.length, 2)
    );
  }, [draft, stored.length]);

  const displayDays = useMemo(() => {
    if (stored.length === 0) {
      return buildDefaultItineraryDays(targetDayCount);
    }
    if (stored.length < targetDayCount) {
      return [
        ...stored,
        ...buildDefaultItineraryDays(targetDayCount - stored.length).map((day, offset) => ({
          ...day,
          dayNumber: stored.length + offset + 1,
        })),
      ];
    }
    if (stored.length > targetDayCount) {
      return stored.slice(0, targetDayCount);
    }
    return stored;
  }, [stored, targetDayCount]);

  const writeDays = (days: DenaliItineraryDay[]) => {
    onDraftChange(setCanonicalValue(draft, "program.itinerary", days));
  };

  const updateDay = (index: number, patch: Partial<DenaliItineraryDay>) => {
    writeDays(displayDays.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)));
  };

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_ITINERARY_TEST_IDS.itinerary}>
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">
          {t("composites.itinerary.helper", { count: targetDayCount })}
        </p>
      </div>

      {displayDays.map((day, index) => (
        <section key={day.dayNumber ?? index} className="denali-wizard-composite__panel">
          <h4 className="denali-wizard-composite__subtitle">
            {t("composites.itinerary.dayHeading", { n: day.dayNumber ?? index + 1 })}
          </h4>
          <label className="denali-wizard-composite__field">
            <span>{tCommon("title")}</span>
            <Input
              value={day.title ?? ""}
              onChange={(event) => updateDay(index, { title: event.target.value })}
              required={required}
              aria-required={required || undefined}
            />
          </label>
          <label className="denali-wizard-composite__field">
            <span>{tCommon("description")}</span>
            <Input
              value={day.description ?? ""}
              onChange={(event) => updateDay(index, { description: event.target.value })}
            />
          </label>
        </section>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => writeDays(buildDefaultItineraryDays(targetDayCount))}
      >
        {t("composites.itinerary.resetRows", { count: targetDayCount })}
      </Button>
    </div>
  );
}
