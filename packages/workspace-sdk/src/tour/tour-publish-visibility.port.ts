import type { CanonicalDocument } from "../canonical/canonical-document";

/**
 * CW5-04 — port types re-homed to tour-core; SDK keeps CanonicalDocument predicate surface.
 */
export type {
  TourPublishVisibilityBinding,
  TourPublishVisibilityPort,
} from "@app-tour/tour-core";

export type TourPublishVisibilityPredicate = (
  canonical: CanonicalDocument,
) => boolean;
