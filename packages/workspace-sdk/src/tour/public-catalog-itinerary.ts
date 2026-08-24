/**
 * CW7-10 — neutral egress-safe itinerary fields on public catalog cards.
 * Workspace adapters map canonical tour data into these shapes; no platform day/segment schema.
 */

export type {
  PublicCatalogItineraryDay,
  PublicCatalogItinerarySegment,
} from "./public-catalog.contract";

/** Egress-safe itinerary scalars — workspace-owned semantics at canonical layer. */
export type PublicCatalogItineraryFields = {
  readonly itineraryDays?: readonly import("./public-catalog.contract").PublicCatalogItineraryDay[];
};
