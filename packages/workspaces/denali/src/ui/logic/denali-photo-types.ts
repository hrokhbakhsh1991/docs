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

/** Estimate day count from start/end ISO datetimes (inclusive calendar days, min 2 for multi-day). */
export function estimateDenaliTourDayCount(
  startDateTime: string,
  endDateTime: string
): number | undefined {
  const start = Date.parse(startDateTime);
  const end = Date.parse(endDateTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return undefined;
  }
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  const diffMs = endDay.getTime() - startDay.getTime();
  const days = Math.floor(diffMs / 86_400_000) + 1;
  return days >= 2 ? days : 2;
}
