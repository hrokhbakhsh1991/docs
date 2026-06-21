import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isUrbanTourPublished } from "../http/publish-status";

export type UrbanTourPublishStatus = "draft" | "published";

export type UrbanTourPublishTransition = "published" | "unpublished";

function readTourRecord(data: CanonicalDocument["data"]): Record<string, unknown> | undefined {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const tour = data.tour;
  if (tour == null || typeof tour !== "object" || Array.isArray(tour)) {
    return undefined;
  }
  return tour as Record<string, unknown>;
}

function normalizeUrbanPublishStatus(raw: unknown): UrbanTourPublishStatus | undefined {
  if (raw === "published" || raw === "draft") {
    return raw;
  }
  return undefined;
}

export function readUrbanTourPublishStatusFromCanonical(
  canonical: CanonicalDocument
): UrbanTourPublishStatus | undefined {
  const tour = readTourRecord(canonical.data);
  if (tour === undefined) {
    return undefined;
  }
  return normalizeUrbanPublishStatus(tour.publishStatus ?? tour.status);
}

/** Detect owner publish/unpublish transition from merged canonical before/after PATCH. */
export function detectUrbanTourPublishTransition(
  beforeData: Readonly<Record<string, unknown>>,
  afterData: Readonly<Record<string, unknown>>
): UrbanTourPublishTransition | null {
  const beforeTour = beforeData.tour;
  const afterTour = afterData.tour;
  const beforeCanonical = {
    schemaVersion: 1,
    roots: ["tour"],
    data: { tour: beforeTour },
  } satisfies CanonicalDocument;
  const afterCanonical = {
    schemaVersion: 1,
    roots: ["tour"],
    data: { tour: afterTour },
  } satisfies CanonicalDocument;

  const wasPublished = isUrbanTourPublished(beforeCanonical);
  const isPublished = isUrbanTourPublished(afterCanonical);
  if (!wasPublished && isPublished) {
    return "published";
  }
  if (wasPublished && !isPublished) {
    return "unpublished";
  }
  return null;
}
