/**
 * Phase 9.3 — operator tour list projection contract (DEC-P9-014).
 * @see docs/phase-9/appendices/TOURS-LIST-UX.md §4.2
 */
import type { CanonicalDocument } from "../canonical/canonical-document";

export type TourListStatus =
  | "draft"
  | "open"
  | "published"
  | "closed"
  | "cancelled"
  | "archived";

export type TourUiStatus = "draft" | "active" | "archived";

export type TourListRowMeta = {
  readonly id: string;
  readonly tenantId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rowVersion: number;
};

/** Canonical-derived list fields — merged with {@link TourListRowMeta} at API layer. */
export type TourListProjectionFields = {
  readonly title: string;
  readonly shortDescription: string | null;
  readonly listStatus: TourListStatus;
  readonly uiStatus: TourUiStatus;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly totalCapacity: number | null;
  readonly acceptedCount: number;
  readonly category: string | null;
  readonly coverImageUrl: string | null;
  /** MinIO object key for operator BFF signed-read when `coverImageUrl` is not yet resolved. */
  readonly coverImageStorageKey: string | null;
  readonly departureAt: string | null;
};

export type TourListProjection = TourListRowMeta & TourListProjectionFields;

export type TourListProjectionExtractor = {
  extractTourListProjection(canonical: CanonicalDocument): TourListProjectionFields;
};

export type OperatorTourListSurface = {
  readonly extractTourListProjection: TourListProjectionExtractor["extractTourListProjection"];
};

/** Merge persisted row metadata with workspace-specific canonical extraction. */
export function buildTourListProjection(
  row: TourListRowMeta,
  canonical: CanonicalDocument,
  extract: TourListProjectionExtractor["extractTourListProjection"]
): TourListProjection {
  return Object.freeze({
    ...row,
    ...extract(canonical),
  });
}
