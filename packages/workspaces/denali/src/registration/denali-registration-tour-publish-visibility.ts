import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isDenaliTourPublished } from "../catalog/denali-publish-status";

/**
 * CW3-04 — manifest `canonicalTour.publishVisibilityExport` binding for registration gate.
 * Strangler compat: direct `isDenaliTourPublished` retained until census zero; parity vs API dispatch.
 */
export function resolveDenaliRegistrationTourPublishVisibility(
  canonical: CanonicalDocument,
): boolean {
  return isDenaliTourPublished(canonical);
}
