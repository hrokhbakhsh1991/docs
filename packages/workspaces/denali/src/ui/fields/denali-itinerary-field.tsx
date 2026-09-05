"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  buildDefaultItineraryDays,
  collectDenaliItineraryDayValidationIssues,
  createEmptyDenaliItinerarySegment,
  parseDenaliItineraryDays,
  type DenaliItineraryDay,
  type DenaliItinerarySegment,
  type DenaliItinerarySegmentKind,
} from "../../schemas/denaliItineraryDaySchema";
import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { Button, type SelectOption } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { estimateDenaliTourDayCount, parseDenaliTourPhotos } from "../logic/denali-photo-types";
import {
  findFirstDenaliItineraryDayIssueIndex,
  resolveDenaliItineraryDayStatuses,
} from "../logic/denali-itinerary-day-status";
import { DenaliItineraryDayPanel } from "./denali-itinerary-day-panel";
import { DENALI_ITINERARY_TEST_IDS } from "../test-ids/denali-itinerary-test-ids";

export { DENALI_ITINERARY_TEST_IDS } from "../test-ids/denali-itinerary-test-ids";

type DenaliItineraryFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
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
  invalid = false,
}: DenaliItineraryFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = t("composites.itinerary.sectionTitle");
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
      ) ?? Math.max(stored.length, 1)
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

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    if (activeDayIndex < displayDays.length) {
      return;
    }
    setActiveDayIndex(Math.max(0, displayDays.length - 1));
  }, [activeDayIndex, displayDays.length]);

  const dayStatuses = useMemo(
    () => resolveDenaliItineraryDayStatuses(displayDays, { showValidationErrors: invalid }),
    [displayDays, invalid]
  );

  const { invalidDayIndexes, invalidSegmentKeys } = useMemo(() => {
    const days = new Set<number>();
    const segments = new Set<string>();
    if (!invalid) {
      return { invalidDayIndexes: days, invalidSegmentKeys: segments };
    }
    for (const issue of collectDenaliItineraryDayValidationIssues(displayDays)) {
      if (issue.segmentIndex == null) {
        days.add(issue.dayIndex);
      } else {
        segments.add(`${issue.dayIndex}:${issue.segmentIndex}`);
      }
    }
    return { invalidDayIndexes: days, invalidSegmentKeys: segments };
  }, [invalid, displayDays]);

  useEffect(() => {
    if (!invalid) {
      return;
    }
    const firstInvalid = findFirstDenaliItineraryDayIssueIndex(displayDays);
    if (firstInvalid != null) {
      setActiveDayIndex(firstInvalid);
    }
  }, [invalid, displayDays]);

  const writeDays = (days: DenaliItineraryDay[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "program.itinerary", days)
    );
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

  const activeDay = displayDays[activeDayIndex] ?? displayDays[0];
  const canGoPrevious = activeDayIndex > 0;
  const canGoNext = activeDayIndex < displayDays.length - 1;

  const selectDay = (dayIndex: number) => {
    if (dayIndex < 0 || dayIndex >= displayDays.length) {
      return;
    }
    setActiveDayIndex(dayIndex);
  };

  const dayPreview = (day: DenaliItineraryDay): string => {
    const trimmed = day.title.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
    return t("composites.itinerary.dayPreviewEmpty");
  };

  const statusLabel = (status: "complete" | "incomplete" | "error"): string => {
    switch (status) {
      case "complete":
        return t("composites.itinerary.dayStatusComplete");
      case "error":
        return t("composites.itinerary.dayStatusError");
      default:
        return t("composites.itinerary.dayStatusIncomplete");
    }
  };

  return (
    <div
      className="denali-wizard-composite denali-wizard-composite--itinerary"
      data-operator-wizard-surface="section"
      data-testid={DENALI_ITINERARY_TEST_IDS.itinerary}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">
          {t("composites.itinerary.helper", { count: targetDayCount })}
        </p>
      </div>

      <div className="denali-itinerary-layout">
        <nav
          className="denali-itinerary-nav"
          data-testid={DENALI_ITINERARY_TEST_IDS.nav}
          aria-label={t("composites.itinerary.navLabel")}
        >
          <ol className="denali-itinerary-nav__list">
            {displayDays.map((day, dayIndex) => {
              const dayNumber = day.dayNumber ?? dayIndex + 1;
              const status = dayStatuses[dayIndex] ?? "incomplete";
              const isActive = dayIndex === activeDayIndex;
              return (
                <li key={day.dayNumber ?? dayIndex} className="denali-itinerary-nav__item">
                  <button
                    type="button"
                    className="denali-itinerary-nav__button"
                    data-testid={DENALI_ITINERARY_TEST_IDS.dayNav(dayNumber)}
                    data-denali-itinerary-day-nav=""
                    data-denali-itinerary-day-status={status}
                    aria-current={isActive ? "true" : undefined}
                    aria-describedby={`denali-itinerary-day-${dayNumber}-status`}
                    onClick={() => selectDay(dayIndex)}
                  >
                    <span className="denali-itinerary-nav__day-label">
                      {t("composites.itinerary.dayHeading", { n: dayNumber })}
                    </span>
                    <span className="denali-itinerary-nav__day-preview">{dayPreview(day)}</span>
                    <span
                      id={`denali-itinerary-day-${dayNumber}-status`}
                      className={`denali-itinerary-nav__status denali-itinerary-nav__status--${status}`}
                      data-testid={DENALI_ITINERARY_TEST_IDS.dayNavStatus(dayNumber)}
                      aria-hidden="true"
                    >
                      {status === "complete" ? "✓" : status === "error" ? "!" : "○"}
                    </span>
                    <span className="denali-itinerary-nav__status-text">
                      {statusLabel(status)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="denali-itinerary-editor">
          {activeDay != null ? (
            <DenaliItineraryDayPanel
              draft={draft}
              day={activeDay}
              dayIndex={activeDayIndex}
              tourPhotos={tourPhotos}
              kindOptions={kindOptions}
              required={required}
              dayInvalid={invalidDayIndexes.has(activeDayIndex)}
              invalidSegmentKeys={invalidSegmentKeys}
              onUpdateDay={(patch) => updateDay(activeDayIndex, patch)}
              onUpdateSegment={(segmentIndex, patch) =>
                updateSegment(activeDayIndex, segmentIndex, patch)
              }
              onAddSegment={() => addSegment(activeDayIndex)}
              onRemoveSegment={(segmentIndex) => removeSegment(activeDayIndex, segmentIndex)}
            />
          ) : null}

          {displayDays.length > 1 ? (
            <div className="denali-itinerary-editor__pager">
              <Button
                type="button"
                variant="secondary"
                data-testid={DENALI_ITINERARY_TEST_IDS.prevDay}
                disabled={!canGoPrevious}
                onClick={() => selectDay(activeDayIndex - 1)}
              >
                {t("composites.itinerary.previousDay")}
              </Button>
              <p className="denali-itinerary-editor__pager-meta">
                {t("composites.itinerary.dayPager", {
                  current: activeDayIndex + 1,
                  total: displayDays.length,
                })}
              </p>
              <Button
                type="button"
                variant="secondary"
                data-testid={DENALI_ITINERARY_TEST_IDS.nextDay}
                disabled={!canGoNext}
                onClick={() => selectDay(activeDayIndex + 1)}
              >
                {t("composites.itinerary.nextDay")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          writeDays(buildDefaultItineraryDays(targetDayCount));
          setActiveDayIndex(0);
        }}
      >
        {t("composites.itinerary.resetRows", { count: targetDayCount })}
      </Button>
    </div>
  );
}
