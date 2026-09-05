"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliItineraryDay,
  type DenaliItinerarySegment,
  type DenaliItinerarySegmentKind,
} from "../../schemas/denaliItineraryDaySchema";
import { getCanonicalStringValue, type DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import { Button, Input, Select, type SelectOption } from "../adapters/platform-primitives";
import { DenaliTimeInput } from "../components/denali-time-input";
import { DenaliItinerarySegmentDestinationField } from "../components/denali-itinerary-segment-destination-field";
import { DenaliItinerarySegmentPhotoPicker } from "../components/denali-itinerary-segment-photo-picker";
import type { DenaliTourPhoto } from "../logic/denali-photo-types";
import { DENALI_ITINERARY_TEST_IDS } from "../test-ids/denali-itinerary-test-ids";

type DenaliItineraryDayPanelProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly day: DenaliItineraryDay;
  readonly dayIndex: number;
  readonly tourPhotos: readonly DenaliTourPhoto[];
  readonly kindOptions: readonly SelectOption[];
  readonly required?: boolean;
  readonly dayInvalid?: boolean;
  readonly invalidSegmentKeys: ReadonlySet<string>;
  readonly onUpdateDay: (patch: Partial<DenaliItineraryDay>) => void;
  readonly onUpdateSegment: (segmentIndex: number, patch: Partial<DenaliItinerarySegment>) => void;
  readonly onAddSegment: () => void;
  readonly onRemoveSegment: (segmentIndex: number) => void;
};

export function DenaliItineraryDayPanel({
  draft,
  day,
  dayIndex,
  tourPhotos,
  kindOptions,
  required = false,
  dayInvalid = false,
  invalidSegmentKeys,
  onUpdateDay,
  onUpdateSegment,
  onAddSegment,
  onRemoveSegment,
}: DenaliItineraryDayPanelProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const dayNumber = day.dayNumber ?? dayIndex + 1;

  return (
    <section
      className="denali-wizard-composite__panel denali-wizard-composite__panel--active-day"
      data-testid={DENALI_ITINERARY_TEST_IDS.day(dayNumber)}
      data-denali-itinerary-active-day=""
      aria-labelledby={`denali-itinerary-day-${dayNumber}-title`}
    >
      <h4
        id={`denali-itinerary-day-${dayNumber}-title`}
        className="denali-wizard-composite__subtitle"
      >
        {t("composites.itinerary.dayHeading", { n: dayNumber })}
      </h4>

      <label className="denali-wizard-composite__field">
        <span>{t("composites.itinerary.dayTitle")}</span>
        <Input
          value={day.title ?? ""}
          onChange={(event) => onUpdateDay({ title: event.target.value })}
          required={required}
          aria-required={required || undefined}
          invalid={dayInvalid}
        />
      </label>

      <label className="denali-wizard-composite__field">
        <span>{t("composites.itinerary.daySummary")}</span>
        <textarea
          className="denali-wizard-composite__textarea"
          rows={3}
          value={day.summary ?? ""}
          onChange={(event) => onUpdateDay({ summary: event.target.value })}
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
            data-testid={DENALI_ITINERARY_TEST_IDS.segment(dayNumber, segment.id)}
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
                  onClick={() => onRemoveSegment(segmentIndex)}
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
                  onUpdateSegment(segmentIndex, {
                    kind: event.target.value as DenaliItinerarySegmentKind,
                  })
                }
              />
            </label>

            <label className="denali-wizard-composite__field">
              <span>{tCommon("title")}</span>
              <Input
                value={segment.title}
                onChange={(event) => onUpdateSegment(segmentIndex, { title: event.target.value })}
                required={required}
                aria-required={required || undefined}
                invalid={invalidSegmentKeys.has(`${dayIndex}:${segmentIndex}`)}
              />
            </label>

            <label className="denali-wizard-composite__field">
              <span>{tCommon("description")}</span>
              <textarea
                className="denali-wizard-composite__textarea"
                rows={2}
                value={segment.description ?? ""}
                onChange={(event) =>
                  onUpdateSegment(segmentIndex, { description: event.target.value })
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
                  onChange={(next) => onUpdateSegment(segmentIndex, { startTime: next })}
                />
              </label>
              <label className="denali-wizard-composite__field">
                <span>{t("composites.itinerary.locationLabel")}</span>
                <Input
                  value={segment.locationLabel ?? ""}
                  onChange={(event) =>
                    onUpdateSegment(segmentIndex, { locationLabel: event.target.value })
                  }
                  placeholder={t("composites.itinerary.locationPlaceholder")}
                />
              </label>
            </div>

            <DenaliItinerarySegmentDestinationField
              destinationId={segment.destinationId}
              tourKind={getCanonicalStringValue(draft, "category")}
              onChange={(selection) => {
                if (selection.destinationId != null) {
                  onUpdateSegment(segmentIndex, {
                    destinationId: selection.destinationId,
                    ...(selection.locationLabel != null
                      ? { locationLabel: selection.locationLabel }
                      : {}),
                  });
                  return;
                }
                const { destinationId: _removed, ...rest } = segment;
                onUpdateSegment(segmentIndex, rest);
              }}
            />

            <DenaliItinerarySegmentPhotoPicker
              photos={tourPhotos}
              selectedIds={segment.photoIds ?? []}
              dayNumber={dayNumber}
              onChange={(photoIds) => {
                if (photoIds.length > 0) {
                  onUpdateSegment(segmentIndex, { photoIds });
                  return;
                }
                const { photoIds: _removed, ...rest } = segment;
                onUpdateSegment(segmentIndex, rest);
              }}
            />
          </article>
        ))}

        <Button
          type="button"
          variant="secondary"
          data-testid={DENALI_ITINERARY_TEST_IDS.addSegment(dayNumber)}
          onClick={onAddSegment}
        >
          {t("composites.itinerary.addSegment")}
        </Button>
      </div>
    </section>
  );
}
