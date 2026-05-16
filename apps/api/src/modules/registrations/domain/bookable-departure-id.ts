import type { TourEntity } from "../../tours/entities/tour.entity";

/** Bookable departure id for registrations (foundation: often same as `tour.id`). */
export function bookableTourDepartureId(tour: Pick<TourEntity, "id" | "tourDepartureId">): string {
  return tour.tourDepartureId ?? tour.id;
}
