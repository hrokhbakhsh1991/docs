import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { detectWorkspaceTourPublishTransition } from "@app-tour/workspace-sdk";

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
