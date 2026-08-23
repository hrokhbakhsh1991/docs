import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isHarborTourPublished } from "../catalog/to-harbor-catalog-card";

/**
 * CW3-04 — manifest `canonicalTour.publishVisibilityExport` binding for registration gate.
 * Strangler compat: direct `isHarborTourPublished` retained until census zero; parity vs API dispatch.
 */
export function resolveHarborRegistrationTourPublishVisibility(
  canonical: CanonicalDocument,
): boolean {
  return isHarborTourPublished(canonical);
}
