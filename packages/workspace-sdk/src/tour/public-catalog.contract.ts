/**
 * Public marketing catalog contract — workspace-owned card shape (ADR-MKT-003).
 * @see docs/workspaces/denali/public-catalog.md
 */
import type { CanonicalDocument } from "../canonical/canonical-document";

/** Egress-safe itinerary segment on public catalog cards (Denali multi-day tours). */
export type PublicCatalogItinerarySegment = {
  readonly title: string;
  readonly kind?: string;
  readonly startTime?: string;
  readonly locationLabel?: string;
  readonly photoUrls?: readonly string[];
};

/** Egress-safe itinerary day on public catalog cards. */
export type PublicCatalogItineraryDay = {
  readonly dayNumber: number;
  readonly title: string;
  readonly summary?: string;
  readonly segments: readonly PublicCatalogItinerarySegment[];
};

/** Egress-safe list card — workspaces extend via additional fields at API layer. */
export type PublicCatalogCard = {
  readonly id: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly category: string | null;
  readonly departureAt: string | null;
  readonly endAt: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string;
  readonly coverImageUrl: string | null;
  readonly totalCapacity: number | null;
  /** Remaining seats when host enriches from approved booking occupancy (DEC-P11-013). */
  readonly spotsRemaining?: number | null;
  readonly difficultyLevel?: number | null;
  readonly fitnessLevel?: string | null;
  readonly itineraryDays?: readonly PublicCatalogItineraryDay[];
  /** Schema.org JSON-LD blob when workspace builds structured data (e.g. TouristTrip). */
  readonly structuredData?: Readonly<Record<string, unknown>>;
};

export type PublicCatalogTourInput = {
  readonly id: string;
  readonly canonical: CanonicalDocument;
};

export type PublicCatalogSurface = {
  readonly isPublished: (canonical: CanonicalDocument) => boolean;
  readonly toCatalogCard: (tour: PublicCatalogTourInput) => PublicCatalogCard;
};
