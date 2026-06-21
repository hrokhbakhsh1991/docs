/**
 * Urban operator tour list projection (P15 follow-up — SMK-P15-W-D2 list title).
 * @see docs/phase-9/appendices/TOURS-LIST-UX.md §4
 */
import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type {
  TourListProjectionFields,
  TourListStatus,
  TourUiStatus,
} from "@app-tour/workspace-sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
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

function readUrbanTourData(canonical: CanonicalDocument): Record<string, unknown> | undefined {
  const data = canonical.data;
  if (!isRecord(data)) {
    return undefined;
  }
  const tour = data.tour;
  if (!isRecord(tour)) {
    return undefined;
  }
  return tour;
}

function normalizeUrbanListStatus(publishStatus: unknown): {
  listStatus: TourListStatus;
  uiStatus: TourUiStatus;
} {
  if (publishStatus === "published") {
    return { listStatus: "published", uiStatus: "active" };
  }
  if (publishStatus === "archived") {
    return { listStatus: "archived", uiStatus: "archived" };
  }
  return { listStatus: "draft", uiStatus: "draft" };
}

/** Extract operator list fields from an urban canonical document (`data.tour.*`). */
export function extractUrbanTourListProjection(
  canonical: CanonicalDocument
): TourListProjectionFields {
  const tour = readUrbanTourData(canonical);
  const title = readString(tour?.title) ?? "Untitled tour";
  const publishStatus = tour?.publishStatus ?? tour?.status;
  const { listStatus, uiStatus } = normalizeUrbanListStatus(publishStatus);

  return Object.freeze({
    title,
    shortDescription:
      readString(tour?.catalogSummary) ?? readString(tour?.description),
    listStatus,
    uiStatus,
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: readInteger(tour?.capacity),
    acceptedCount: 0,
    category: readString(tour?.city),
    coverImageUrl: readString(tour?.coverImageUrl),
    departureAt: readString(tour?.startDate),
  });
}
