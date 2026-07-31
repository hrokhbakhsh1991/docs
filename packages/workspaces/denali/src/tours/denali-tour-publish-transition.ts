import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { detectWorkspaceTourPublishTransition } from "@app-tour/workspace-sdk";

import {
  DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
  DENALI_TOUR_PUBLISH_DRAFT_STATUS,
} from "./denali-tour-patch-intent";

export { DENALI_TOUR_PUBLISH_ACTIVE_STATUS, DENALI_TOUR_PUBLISH_DRAFT_STATUS };

export type DenaliTourPublishStatus =
  | typeof DENALI_TOUR_PUBLISH_DRAFT_STATUS
  | typeof DENALI_TOUR_PUBLISH_ACTIVE_STATUS;

export type DenaliTourPublishTransition = "published" | "unpublished";

function readPublishStatusFromData(
  data: Record<string, unknown> | undefined,
): DenaliTourPublishStatus | undefined {
  if (data === undefined) {
    return undefined;
  }
  const flat = data.publishStatus;
  if (flat === DENALI_TOUR_PUBLISH_ACTIVE_STATUS || flat === DENALI_TOUR_PUBLISH_DRAFT_STATUS) {
    return flat;
  }
  const basicInfo = data.basicInfo;
  if (basicInfo != null && typeof basicInfo === "object" && !Array.isArray(basicInfo)) {
    const nested = (basicInfo as Record<string, unknown>).publishStatus;
    if (
      nested === DENALI_TOUR_PUBLISH_ACTIVE_STATUS ||
      nested === DENALI_TOUR_PUBLISH_DRAFT_STATUS
    ) {
      return nested;
    }
  }
  return undefined;
}

export function readDenaliTourPublishStatusFromCanonical(
  canonical: CanonicalDocument,
): DenaliTourPublishStatus | undefined {
  const data = canonical.data;
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  return readPublishStatusFromData(data as Record<string, unknown>);
}

/** Detect owner publish/unpublish transition from merged canonical before/after PATCH. */
export function detectDenaliTourPublishTransition(
  beforeData: Readonly<Record<string, unknown>>,
  afterData: Readonly<Record<string, unknown>>,
): DenaliTourPublishTransition | null {
  const before = readPublishStatusFromData(beforeData) ?? DENALI_TOUR_PUBLISH_DRAFT_STATUS;
  const after = readPublishStatusFromData(afterData) ?? DENALI_TOUR_PUBLISH_DRAFT_STATUS;
  return detectWorkspaceTourPublishTransition(
    before === DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
    after === DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
  );
}
