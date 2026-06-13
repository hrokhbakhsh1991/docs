"use client";

import React, { useMemo } from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { DenaliTimeInput } from "@/components/i18n/denali-time-input";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import {
  buildDefaultItineraryDays,
  createEmptyDenaliItinerarySegment,
  parseDenaliItineraryDays,
  type DenaliItineraryDay,
  type DenaliItinerarySegment,
  type DenaliItinerarySegmentKind,
} from "./denali-itinerary-types";
import { DenaliItinerarySegmentDestinationField } from "./denali-itinerary-segment-destination-field";
import { DenaliItinerarySegmentPhotoPicker } from "./denali-itinerary-segment-photo-picker";
import { estimateDenaliTourDayCount, parseDenaliTourPhotos } from "./denali-photo-types";
import { DENALI_ITINERARY_TEST_IDS } from "./denali-itinerary-test-ids";

export { DENALI_ITINERARY_TEST_IDS } from "./denali-itinerary-test-ids";

type DenaliItineraryFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

const SEGMENT_KINDS: readonly DenaliItinerarySegmentKind[] = [
  "activity",
  "transport",
  "meal",
  "rest",
  "accommodation",
  "free_time",
  "note",
];

export function DenaliItineraryField({
  draft,
  onDraftChange,
  required = false,
}: DenaliItineraryFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const label = resolveDenaliFieldLabel(t, "program.itinerary");
  const stored = parseDenaliItineraryDays(getCanonicalValue(draft, "program.itinerary"));
  const tourPhotos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));

  const kindOptions: readonly SelectOption[] = useMemo(
    () =>
      SEGMENT_KINDS.map((kind) => ({
        value: kind,
        label: t(`composites.itinerary.segmentKinds.${kind}`),
      })),
    [t]
  );

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

  const updateSegment = (
    dayIndex: number,
    segmentIndex: number,
    patch: Partial<DenaliItinerarySegment>
  ) => {
    const day = displayDays[dayIndex];
    if (day == null) {
      return;
    }
    const segments = day.segments.map((segment, index) =>
      index === segmentIndex ? { ...segment, ...patch } : segment
    );
    updateDay(dayIndex, { segments });
  };

  const addSegment = (dayIndex: number) => {
    const day = displayDays[dayIndex];
    if (day == null) {
      return;
    }
    updateDay(dayIndex, {
      segments: [...day.segments, createEmptyDenaliItinerarySegment()],
    });
  };

  const removeSegment = (dayIndex: number, segmentIndex: number) => {
    const day = displayDays[dayIndex];
    if (day == null || day.segments.length <= 1) {
      return;
    }
    updateDay(dayIndex, {
      segments: day.segments.filter((_, index) => index !== segmentIndex),
    });
  };

  return (
    <div
      className="denali-wizard-composite denali-wizard-composite--itinerary"
      data-denali-wizard-surface="section"
      data-testid={DENALI_ITINERARY_TEST_IDS.itinerary}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">
          {t("composites.itinerary.helper", { count: targetDayCount })}
        </p>
      </div>

      {displayDays.map((day, dayIndex) => (
        <section
          key={day.dayNumber ?? dayIndex}
          className="denali-wizard-composite__panel"
          data-testid={DENALI_ITINERARY_TEST_IDS.day(day.dayNumber ?? dayIndex + 1)}
        >
          <h4 className="denali-wizard-composite__subtitle">
            {t("composites.itinerary.dayHeading", { n: day.dayNumber ?? dayIndex + 1 })}
          </h4>

          <label className="denali-wizard-composite__field">
            <span>{t("composites.itinerary.dayTitle")}</span>
            <Input
              value={day.title ?? ""}
              onChange={(event) => updateDay(dayIndex, { title: event.target.value })}
              required={required}
              aria-required={required || undefined}
            />
          </label>

          <label className="denali-wizard-composite__field">
            <span>{t("composites.itinerary.daySummary")}</span>
            <textarea
              className="denali-wizard-composite__textarea"
              rows={3}
              value={day.summary ?? ""}
              onChange={(event) => updateDay(dayIndex, { summary: event.target.value })}
            />
          </label>

          <div className="denali-wizard-composite__segment-list">
            <p className="denali-wizard-composite__segment-list-heading">
              {t("composites.itinerary.segmentsHeading")}
            </p>
            {day.segments.map((segment, segmentIndex) => (
              <article
                key={segment.id}
                className="denali-wizard-composite__segment"
                data-testid={DENALI_ITINERARY_TEST_IDS.segment(
                  day.dayNumber ?? dayIndex + 1,
                  segment.id
                )}
              >
                <div className="denali-wizard-composite__segment-header">
                  <h5 className="denali-wizard-composite__segment-title">
                    {t("composites.itinerary.segmentHeading", {
                      n: segmentIndex + 1,
                    })}
                  </h5>
                  {day.segments.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeSegment(dayIndex, segmentIndex)}
                    >
                      {tCommon("remove")}
                    </Button>
                  ) : null}
                </div>

                <label className="denali-wizard-composite__field">
                  <span>{t("composites.itinerary.segmentKind")}</span>
                  <Select
                    aria-label={t("composites.itinerary.segmentKind")}
                    options={kindOptions}
                    value={segment.kind}
                    onChange={(event) =>
                      updateSegment(dayIndex, segmentIndex, {
                        kind: event.target.value as DenaliItinerarySegmentKind,
                      })
                    }
                  />
                </label>

                <label className="denali-wizard-composite__field">
                  <span>{tCommon("title")}</span>
                  <Input
                    value={segment.title}
                    onChange={(event) =>
                      updateSegment(dayIndex, segmentIndex, { title: event.target.value })
                    }
                    required={required}
                    aria-required={required || undefined}
                  />
                </label>

                <label className="denali-wizard-composite__field">
                  <span>{tCommon("description")}</span>
                  <textarea
                    className="denali-wizard-composite__textarea"
                    rows={2}
                    value={segment.description ?? ""}
                    onChange={(event) =>
                      updateSegment(dayIndex, segmentIndex, { description: event.target.value })
                    }
                  />
                </label>

                <div className="denali-wizard-composite__field-row">
                  <label className="denali-wizard-composite__field">
                    <span>{t("composites.itinerary.startTime")}</span>
                    <DenaliTimeInput
                      appearance="field"
                      aria-label={t("composites.itinerary.startTime")}
                      value={segment.startTime ?? ""}
                      onChange={(next) =>
                        updateSegment(dayIndex, segmentIndex, { startTime: next })
                      }
                    />
                  </label>
                  <label className="denali-wizard-composite__field">
                    <span>{t("composites.itinerary.locationLabel")}</span>
                    <Input
                      value={segment.locationLabel ?? ""}
                      onChange={(event) =>
                        updateSegment(dayIndex, segmentIndex, { locationLabel: event.target.value })
                      }
                      placeholder={t("composites.itinerary.locationPlaceholder")}
                    />
                  </label>
                </div>

                <DenaliItinerarySegmentDestinationField
                  destinationId={segment.destinationId}
                  onChange={(selection) => {
                    if (selection.destinationId != null) {
                      updateSegment(dayIndex, segmentIndex, {
                        destinationId: selection.destinationId,
                        ...(selection.locationLabel != null
                          ? { locationLabel: selection.locationLabel }
                          : {}),
                      });
                      return;
                    }
                    const { destinationId: _removed, ...rest } = segment;
                    updateSegment(dayIndex, segmentIndex, rest);
                  }}
                />

                <DenaliItinerarySegmentPhotoPicker
                  photos={tourPhotos}
                  selectedIds={segment.photoIds ?? []}
                  dayNumber={day.dayNumber ?? dayIndex + 1}
                  onChange={(photoIds) => {
                    if (photoIds.length > 0) {
                      updateSegment(dayIndex, segmentIndex, { photoIds });
                      return;
                    }
                    const { photoIds: _removed, ...rest } = segment;
                    updateSegment(dayIndex, segmentIndex, rest);
                  }}
                />
              </article>
            ))}

            <Button
              type="button"
              variant="secondary"
              data-testid={DENALI_ITINERARY_TEST_IDS.addSegment(day.dayNumber ?? dayIndex + 1)}
              onClick={() => addSegment(dayIndex)}
            >
              {t("composites.itinerary.addSegment")}
            </Button>
          </div>
        </section>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => writeDays(buildDefaultItineraryDays(targetDayCount))}
      >
        {t("composites.itinerary.resetRows", { count: targetDayCount })}
      </Button>
    </div>
  );
}
