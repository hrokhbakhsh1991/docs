import type { PublicCatalogItineraryDay } from "@app-tour/workspace-sdk";

import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

import { CatalogCoverImage } from "./catalog-cover-image";
import {
  formatCatalogItinerarySegmentLine,
  readCatalogItinerarySegmentPhotoUrls,
} from "./catalog-itinerary-display-logic";

type CatalogItinerarySectionProps = {
  readonly days: readonly PublicCatalogItineraryDay[];
  readonly heading: string;
  readonly dayLabel: (dayNumber: number) => string;
  readonly segmentsHeading: string;
  readonly locale: AppLocale;
  readonly sectionId?: string;
  readonly useAccordion?: boolean;
  /** ED-PHOTO-EMPTY-01 — shown when a segment has no public photoUrls. */
  readonly segmentPhotosEmpty?: string;
};

function CatalogItineraryDayBody({
  day,
  dayLabel: _dayLabel,
  segmentsHeading,
  locale,
  segmentPhotosEmpty,
}: {
  readonly day: PublicCatalogItineraryDay;
  readonly dayLabel: (dayNumber: number) => string;
  readonly segmentsHeading: string;
  readonly locale: AppLocale;
  readonly segmentPhotosEmpty?: string;
}) {
  const localize = (text: string) => toLocalizedDigits(text, locale);

  return (
    <>
      {day.summary ? <p>{localize(day.summary)}</p> : null}
      {day.segments.length > 0 ? (
        <div>
          <p>{segmentsHeading}</p>
          <ul>
            {day.segments.map((segment, index) => {
              const photoUrls = readCatalogItinerarySegmentPhotoUrls(segment);
              return (
                <li key={`${day.dayNumber}-${index}`}>
                  {formatCatalogItinerarySegmentLine(segment, locale)}
                  {photoUrls.length > 0 ? (
                    <ul data-marketing-catalog-segment-photos>
                      {photoUrls.map((photoUrl, photoIndex) => (
                        <li key={`${day.dayNumber}-${index}-${photoIndex}`}>
                          <CatalogCoverImage
                            src={photoUrl}
                            alt={segment.title}
                            width={320}
                            height={180}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : segmentPhotosEmpty != null && segmentPhotosEmpty.length > 0 ? (
                    <p
                      data-marketing-catalog-segment-photos-empty
                      role="status"
                    >
                      {segmentPhotosEmpty}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function CatalogItinerarySection({
  days,
  heading,
  dayLabel,
  segmentsHeading,
  locale,
  sectionId,
  useAccordion = false,
  segmentPhotosEmpty,
}: CatalogItinerarySectionProps) {
  if (days.length === 0) {
    return null;
  }

  const localize = (text: string) => toLocalizedDigits(text, locale);

  return (
    <section
      data-marketing-catalog-itinerary
      {...(sectionId != null ? { id: sectionId } : {})}
    >
      <h2>{heading}</h2>
      {days.map((day, index) => {
        const title = day.title ? localize(day.title) : dayLabel(day.dayNumber);
        const body = (
          <CatalogItineraryDayBody
            day={day}
            dayLabel={dayLabel}
            segmentsHeading={segmentsHeading}
            locale={locale}
            segmentPhotosEmpty={segmentPhotosEmpty}
          />
        );

        if (useAccordion) {
          return (
            <details
              key={day.dayNumber}
              data-marketing-catalog-itinerary-day={day.dayNumber}
              open={index === 0}
            >
              <summary>
                <span>{title}</span>
              </summary>
              <article>{body}</article>
            </details>
          );
        }

        return (
          <article key={day.dayNumber} data-marketing-catalog-itinerary-day={day.dayNumber}>
            <h3>{title}</h3>
            {body}
          </article>
        );
      })}
    </section>
  );
}
