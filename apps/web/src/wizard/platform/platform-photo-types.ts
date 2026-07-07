export type PlatformTourPhoto = {
  readonly id: string;
  readonly objectKey?: string;
  readonly url?: string;
  readonly caption?: string;
  readonly dayIndex?: number;
};

export const PLATFORM_MAX_PHOTO_COUNT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parsePlatformTourPhotos(value: unknown): PlatformTourPhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const photos: PlatformTourPhoto[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (id.length === 0) {
      continue;
    }
    photos.push({
      id,
      objectKey: typeof entry.objectKey === "string" ? entry.objectKey : undefined,
      url: typeof entry.url === "string" ? entry.url : undefined,
      caption: typeof entry.caption === "string" ? entry.caption : undefined,
      dayIndex:
        typeof entry.dayIndex === "number" && Number.isFinite(entry.dayIndex)
          ? entry.dayIndex
          : undefined,
    });
  }
  return photos;
}

export function newPlatformPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
