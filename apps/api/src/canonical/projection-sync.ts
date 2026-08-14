import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import {
  isPublicPublishStatusLabel,
  normalizeStoredTourPublishStatus,
} from "./publish-status-labels";
import { readTourPublishStatusLabel } from "./workspace-canonical-tour-dispatch";

export type TourProjectionFields = {
  readonly title: string | null;
  readonly schemaVersion: number;
  readonly publishStatus: string;
  readonly publishedAt: Date | null;
};

/**
 * DEC-003 / RULE-008 — derived columns on `tours` (not a separate projection table).
 */
export function deriveTourProjections(
  canonical: CanonicalDocument,
  options?: {
    readonly workspaceType?: string;
    readonly observedAt?: Date;
    readonly previousPublishedAt?: Date | null;
  }
): TourProjectionFields {
  const basics = canonical.data?.basics;
  const title =
    basics !== null &&
    typeof basics === "object" &&
    "title" in basics &&
    typeof (basics as { title?: unknown }).title === "string"
      ? (basics as { title: string }).title
      : null;
  const publishStatusLabel = readTourPublishStatusLabel(options?.workspaceType, canonical);
  const isPublic = isPublicPublishStatusLabel(publishStatusLabel);

  return {
    title,
    schemaVersion: canonical.schemaVersion,
    publishStatus: normalizeStoredTourPublishStatus(publishStatusLabel),
    publishedAt: isPublic ? options?.previousPublishedAt ?? options?.observedAt ?? null : null,
  };
}
