/**
 * Phase 9.3 — Denali tour list projection extractor (DEC-P9-014 · REQ-P9-032).
 * @see docs/phase-9/appendices/TOURS-LIST-UX.md §4.5
 */
import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type {
  TourListProjectionFields,
  TourListStatus,
  TourUiStatus,
} from "@app-tour/workspace-sdk";

import {
  readDenaliCanonicalPhotoRows,
  readDenaliFirstPhotoHttpsUrl,
  readDenaliFirstPhotoStorageKey,
} from "./read-denali-first-photo";

const DEFAULT_PRICE_CURRENCY = "IRR";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number.isInteger(value) ? value : Math.trunc(value);
}

function normalizeDenaliListStatus(publishStatus: unknown): {
  listStatus: TourListStatus;
  uiStatus: TourUiStatus;
} {
  if (publishStatus === "active") {
    return { listStatus: "open", uiStatus: "active" };
  }
  return { listStatus: "draft", uiStatus: "draft" };
}

/** Extract operator list fields from a Denali canonical document. */
export function extractDenaliTourListProjection(
  canonical: CanonicalDocument
): TourListProjectionFields {
  const data = canonical.data;
  const title = readString(data.title) ?? "Untitled tour";
  const { listStatus, uiStatus } = normalizeDenaliListStatus(data.publishStatus);

  const photoRows = readDenaliCanonicalPhotoRows(data);

  return Object.freeze({
    title,
    shortDescription: readString(readCanonicalPath(data, "program.shortDescription")),
    listStatus,
    uiStatus,
    priceAmount: readInteger(readCanonicalPath(data, "pricing.basePricePerPerson")),
    priceCurrency: DEFAULT_PRICE_CURRENCY,
    totalCapacity: readInteger(data.capacityMax),
    acceptedCount: 0,
    category: readString(data.category),
    coverImageUrl: readDenaliFirstPhotoHttpsUrl(photoRows),
    coverImageStorageKey: readDenaliFirstPhotoStorageKey(photoRows),
    departureAt: readString(data.startDateTime),
  });
}
