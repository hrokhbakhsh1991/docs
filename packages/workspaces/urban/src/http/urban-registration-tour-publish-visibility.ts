import type { UrbanTourRecord } from "./ports/tour-store.port";
import { isUrbanTourPublished } from "./publish-status";

/**
 * CW3-04 — manifest `canonicalTour.publishVisibilityExport` binding for registration gate.
 * Strangler compat: direct `isUrbanTourPublished` retained until census zero; parity vs API dispatch.
 */
export function resolveUrbanRegistrationTourPublishVisibility(
  canonical: UrbanTourRecord["canonical"],
): boolean {
  return isUrbanTourPublished(canonical);
}
