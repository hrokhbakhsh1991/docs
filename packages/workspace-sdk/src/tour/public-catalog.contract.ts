/**
 * Public marketing catalog contract — workspace-owned card shape (ADR-MKT-003).
 */
import type { CanonicalDocument } from "../canonical/canonical-document";
import type { PublicCatalogTransportSnapshot } from "./public-catalog-transport";

export type {
  PublicCatalogTransportMode,
  PublicCatalogTransportSnapshot,
} from "./public-catalog-transport";
export { isPublicCatalogOrganizedTransportMode } from "./public-catalog-transport";

/** Egress-safe itinerary segment on public catalog cards. */
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

/** Egress-safe gear row for public catalog detail. */
export type PublicCatalogGearItem = {
  readonly name: string;
  readonly isRequired: boolean;
};

/** Egress-safe gathering / meeting location for public catalog detail. */
export type PublicCatalogGatheringPoint = {
  readonly label: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
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
  /** Public cancellation / terms copy (egress-safe). */
  readonly policiesText?: string | null;
  /** When true, portal intake may collect national ID if member profile lacks one. */
  readonly nationalIdRequired?: boolean;
  /** When true, portal intake may collect father name if member profile lacks one. */
  readonly fatherNameRequired?: boolean;
  /** When true, portal intake may collect birth date if member profile lacks one. */
  readonly birthDateRequired?: boolean;
  /** Logistics snapshot — when set, portal may show transport intake (capability + card-driven). */
  readonly transport?: PublicCatalogTransportSnapshot;
  readonly cancellationDeadlineHours?: number | null;
  readonly cancellationPenaltyPercentage?: number | null;
  /** Schema.org JSON-LD blob when workspace builds structured data (e.g. TouristTrip). */
  readonly structuredData?: Readonly<Record<string, unknown>>;
  /** Normalized list/detail subtitle — workspace sets at egress (Track A). */
  readonly listSubtitle?: string | null;
  /** Normalized list/detail description — workspace sets at egress (Track A). */
  readonly listDescription?: string | null;
  /** When false, marketing hides price row. Default: show when `priceAmount` set. */
  readonly showListPrice?: boolean;
  /** ISO-8601 catalog freshness for sitemap lastmod and JSON-LD dateModified (workspace egress). */
  readonly catalogUpdatedAt?: string | null;
  /** PR-D — resolved destination display name. */
  readonly destinationLabel?: string | null;
  readonly longDescription?: string | null;
  readonly hikingHoursApprox?: number | null;
  readonly hikingGoHours?: number | null;
  readonly hikingReturnHours?: number | null;
  readonly peakHeightMeters?: number | null;
  readonly trailDistanceKm?: number | null;
  readonly elevationGainMeters?: number | null;
  readonly minimumAge?: number | null;
  readonly maximumAge?: number | null;
  readonly fitnessPrerequisiteText?: string | null;
  readonly approximateReturnTime?: string | null;
  readonly gatheringPoint?: PublicCatalogGatheringPoint | null;
  readonly meetingPointText?: string | null;
  readonly gearItems?: readonly PublicCatalogGearItem[];
  readonly includedServices?: readonly string[];
  readonly excludedServices?: readonly string[];
  readonly includesTourInsurance?: boolean;
  readonly paymentMode?: string | null;
  readonly photoUrls?: readonly string[];
};

export type PublicCatalogTourInput = {
  readonly id: string;
  readonly canonical: CanonicalDocument;
  /** Tour-row freshness passed into card mapper at catalog egress. */
  readonly catalogUpdatedAt?: string | null;
};

export type PublicCatalogSurface = {
  readonly isPublished: (canonical: CanonicalDocument) => boolean;
  readonly toCatalogCard: (tour: PublicCatalogTourInput) => PublicCatalogCard;
};
