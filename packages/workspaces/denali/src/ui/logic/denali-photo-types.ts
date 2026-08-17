import { countInclusiveLocalCalendarDays } from "../../adapters/denaliDatetime";

export type DenaliTourPhoto = {
  readonly id?: string;
  readonly label?: string;
  readonly storageKey?: string;
  readonly url?: string;
  readonly contentType?: string;
  readonly day?: number;
};

export const DENALI_MAX_PHOTO_COUNT = 10;

export function parseDenaliTourPhotos(value: unknown): DenaliTourPhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      ...(typeof entry.id === "string" ? { id: entry.id } : {}),
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
      ...(typeof entry.storageKey === "string" ? { storageKey: entry.storageKey } : {}),
      ...(typeof entry.url === "string" ? { url: entry.url } : {}),
      ...(typeof entry.contentType === "string" ? { contentType: entry.contentType } : {}),
      ...(typeof entry.day === "number" && Number.isFinite(entry.day) && entry.day >= 1
        ? { day: Math.floor(entry.day) }
        : {}),
    }));
}

export function isDenaliMultiDayTourKind(tourKind: string): boolean {
  return tourKind.endsWith("_multi");
}

/** Inclusive local calendar days from start/end ISO. Same YMD → 1; never clamps to 2. */
export function estimateDenaliTourDayCount(
  startDateTime: string,
  endDateTime: string
): number | undefined {
  return countInclusiveLocalCalendarDays(startDateTime, endDateTime);
}
