import type { PublicCatalogItineraryDay } from "@app-tour/workspace-sdk";

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
};

export function CatalogItinerarySection({
  days,
  heading,
  dayLabel,
  segmentsHeading,
}: CatalogItinerarySectionProps) {
  if (days.length === 0) {
    return null;
  }

  return (
    <section data-marketing-catalog-itinerary>
      <h2>{heading}</h2>
      {days.map((day) => (
        <article key={day.dayNumber} data-marketing-catalog-itinerary-day={day.dayNumber}>
          <h3>{day.title || dayLabel(day.dayNumber)}</h3>
          {day.summary ? <p>{day.summary}</p> : null}
          {day.segments.length > 0 ? (
            <div>
              <p>{segmentsHeading}</p>
              <ul>
                {day.segments.map((segment, index) => {
                  const photoUrls = readCatalogItinerarySegmentPhotoUrls(segment);
                  return (
                  <li key={`${day.dayNumber}-${index}`}>
                    {formatCatalogItinerarySegmentLine(segment)}
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
        </article>
      ))}
    </section>
  );
}
