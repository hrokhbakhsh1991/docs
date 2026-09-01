import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import {
  detectWorkspaceTourPublishTransition,
  mergeWorkspaceCanonicalPatchData,
} from "@app-tour/workspace-sdk";

import { isHarborTourPublished } from "../catalog/to-harbor-catalog-card";

export type HarborTourPublishStatus = "draft" | "published";

export type HarborTourPublishTransition = "published" | "unpublished";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function resolveHarborTourFields(canonical: CanonicalDocument): Record<string, unknown> {
  const data = asRecord(canonical.data) ?? {};
  const nested = asRecord(data.tour);
  return nested ?? data;
}

function normalizeHarborPublishStatus(raw: unknown): HarborTourPublishStatus | undefined {
  if (raw === "published" || raw === "draft") {
    return raw;
  }
  return undefined;
}

export function readHarborTourPublishStatusFromCanonical(
  canonical: CanonicalDocument,
): HarborTourPublishStatus | undefined {
  const fields = resolveHarborTourFields(canonical);
  return normalizeHarborPublishStatus(fields.publishStatus ?? fields.status);
}

/** Detect owner publish/unpublish transition from merged canonical before/after PATCH. */
export function detectHarborTourPublishTransition(
  beforeData: Readonly<Record<string, unknown>>,
  afterData: Readonly<Record<string, unknown>>,
): HarborTourPublishTransition | null {
  const before = {
    schemaVersion: 1,
    roots: Object.keys(beforeData),
    data: beforeData,
  } satisfies CanonicalDocument;
  const after = {
    schemaVersion: 1,
    roots: Object.keys(afterData),
    data: afterData,
  } satisfies CanonicalDocument;

  return detectWorkspaceTourPublishTransition(
    isHarborTourPublished(before),
    isHarborTourPublished(after),
  );
}

/**
 * Harbor canonical PATCH merge — deep-merge root objects (G1 stub workspace).
 */
export function mergeHarborCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined,
): T {
  return mergeWorkspaceCanonicalPatchData(existing, patch, "deep-root");
}

/** CASL surface id for owner-only harbor tour publish-field PATCH (stub). */
export const HARBOR_TOUR_PUBLISH_FIELDS_OWNER_SURFACE = "harbor.tour.publish_fields" as const;

export function harborTourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
