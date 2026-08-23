/** Structural canonical input — tour-core does not import SDK CanonicalDocument. */
export type ReadonlyCanonicalShape = {
  readonly data: unknown;
};

/**
 * Workspace-owned predicate: is this tour publicly visible on catalog/registration surfaces?
 *
 * Contract:
 * - Pure function of canonical input (no I/O, no tenant context).
 * - Returns false for missing/malformed canonical shapes (fail-closed).
 * - MUST NOT rename or normalize publish labels — compare workspace vocabulary only.
 * - `archived` and other non-published states MUST return false unless product later decides otherwise (DEC-CW-02).
 */
export type TourPublishVisibilityPredicate = (
  canonical: ReadonlyCanonicalShape,
) => boolean;

/** Single-method port — mirrors PublicCatalogSurface.isPublished seam. */
export type TourPublishVisibilityPort = {
  readonly isTourPubliclyVisible: TourPublishVisibilityPredicate;
};

/** One row in codegen registry (CW3-02). */
export type TourPublishVisibilityBinding = {
  readonly workspaceType: string;
  readonly isTourPubliclyVisible: TourPublishVisibilityPredicate;
};
