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
};

function CatalogItineraryDayBody({
  day,
  dayLabel,
  segmentsHeading,
  locale,
}: {
  readonly day: PublicCatalogItineraryDay;
  readonly dayLabel: (dayNumber: number) => string;
  readonly segmentsHeading: string;
  readonly locale: AppLocale;
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
