/**
 * Public marketing catalog contract — workspace-owned card shape (ADR-MKT-003).
 * @see docs/workspaces/denali/public-catalog.md
 */
import type { CanonicalDocument } from "../canonical/canonical-document";

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
};

export type PublicCatalogTourInput = {
  readonly id: string;
  readonly canonical: CanonicalDocument;
};

export type PublicCatalogSurface = {
  readonly isPublished: (canonical: CanonicalDocument) => boolean;
  readonly toCatalogCard: (tour: PublicCatalogTourInput) => PublicCatalogCard;
};
