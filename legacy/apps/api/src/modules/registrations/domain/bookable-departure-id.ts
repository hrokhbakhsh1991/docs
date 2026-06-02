import type { RegistrationQuoteTourContext } from "./registration-quote-tour.types";

/** Bookable departure id for registrations (foundation: often same as `tour.id`). */
export function bookableTourDepartureId(
  tour: Pick<RegistrationQuoteTourContext, "id" | "tourDepartureId">
): string {
  return tour.tourDepartureId ?? tour.id;
}
