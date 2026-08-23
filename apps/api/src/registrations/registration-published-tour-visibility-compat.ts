import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { isDenaliTourPublished } from "@app-tour/workspace-denali/host/catalog/denali-publish-status";
import { isHarborTourPublished } from "@app-tour/workspace-harbor/host/catalog";
import { isUrbanTourPublished } from "@app-tour/workspace-urban/host/http/publish-status";

import { isTourPubliclyVisible } from "../canonical/workspace-publish-visibility-dispatch";

/**
 * CW3-04 compat — direct workspace publish predicate (retained until census zero).
 * Parity proofs only; registration services use formalized binding modules.
 */
export function isRegistrationTourPublishedViaDirectWorkspaceExport(
  workspaceType: string,
  canonical: CanonicalDocument,
): boolean {
  switch (workspaceType) {
    case "denali":
      return isDenaliTourPublished(canonical);
    case "urban":
      return isUrbanTourPublished(canonical);
    case "harbor":
      return isHarborTourPublished(canonical);
    default:
      return false;
  }
}

/**
 * CW3-04 — manifest-bound dispatch path for registration published-tour gate parity.
 */
export function isRegistrationTourPublishedViaDispatch(
  workspaceType: string,
  canonical: CanonicalDocument,
): boolean {
  return isTourPubliclyVisible(workspaceType, canonical);
}
