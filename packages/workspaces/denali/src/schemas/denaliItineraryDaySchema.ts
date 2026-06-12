import { z } from "zod";

export const DENALI_ITINERARY_SEGMENT_KINDS = [
  "activity",
  "transport",
  "meal",
  "rest",
  "accommodation",
  "free_time",
  "note",
] as const;

export type DenaliItinerarySegmentKind = (typeof DENALI_ITINERARY_SEGMENT_KINDS)[number];

export type DenaliItinerarySegment = {
  readonly id: string;
  readonly kind: DenaliItinerarySegmentKind;
  readonly title: string;
  readonly description?: string;
  readonly startTime?: string;
  readonly locationLabel?: string;
  readonly destinationId?: string;
  readonly photoIds?: readonly string[];
};

export type DenaliItineraryDay = {
  readonly dayNumber: number;
  readonly title: string;
  readonly summary?: string;
  readonly segments: readonly DenaliItinerarySegment[];
};

/** @deprecated Use {@link DenaliItineraryDay} — kept for adapter imports. */
export type DenaliItineraryDayRow = DenaliItineraryDay;

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const denaliItinerarySegmentKindSchema = z.enum(DENALI_ITINERARY_SEGMENT_KINDS);

export const denaliItinerarySegmentSchema = z.object({
  id: z.string().trim().min(1),
  kind: denaliItinerarySegmentKindSchema.default("activity"),
  title: z.string().trim(),
  description: z.string().trim().optional(),
  startTime: z
    .string()
    .trim()
    .optional()
    .refine((value) => value == null || value === "" || HH_MM_RE.test(value), {
      message: "ساعت باید به فرمت HH:mm باشد.",
    })
    .transform((value) => (value == null || value === "" ? undefined : value)),
  locationLabel: z.string().trim().optional(),
  destinationId: z.string().trim().optional(),
  photoIds: z.array(z.string().trim().min(1)).optional(),
});

export const denaliItineraryDayRowSchema = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().trim(),
  summary: z.string().trim().optional(),
  segments: z.array(denaliItinerarySegmentSchema).default([]),
});

export function createDenaliItinerarySegmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDenaliItinerarySegment(): DenaliItinerarySegment {
  return {
    id: createDenaliItinerarySegmentId(),
    kind: "activity",
    title: "",
  };
}

export function buildDefaultItineraryDays(dayCount: number): DenaliItineraryDay[] {
  const count = Math.max(1, Math.min(Math.floor(dayCount), 60));
  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    title: "",
    summary: "",
    segments: [createEmptyDenaliItinerarySegment()],
  }));
}

function parseSegmentPhotoIds(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids.length > 0 ? ids : undefined;
}

function readDayNumber(entry: Record<string, unknown>, index: number): number {
  if (typeof entry.dayNumber === "number" && Number.isFinite(entry.dayNumber)) {
    return Math.max(1, Math.floor(entry.dayNumber));
  }
  if (typeof entry.day === "number" && Number.isFinite(entry.day)) {
    return Math.max(1, Math.floor(entry.day));
  }
  return index + 1;
}

function parseSegmentEntry(value: unknown): DenaliItinerarySegment | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  const kindRaw = typeof entry.kind === "string" ? entry.kind : "activity";
  const kind = (DENALI_ITINERARY_SEGMENT_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as DenaliItinerarySegmentKind)
    : "activity";
  const id =
    typeof entry.id === "string" && entry.id.trim().length > 0
      ? entry.id.trim()
      : createDenaliItinerarySegmentId();
  const photoIds = parseSegmentPhotoIds(entry.photoIds);
  return {
    id,
    kind,
    title,
    ...(typeof entry.description === "string" && entry.description.trim().length > 0
      ? { description: entry.description.trim() }
      : {}),
    ...(typeof entry.startTime === "string" && entry.startTime.trim().length > 0
      ? { startTime: entry.startTime.trim() }
      : {}),
    ...(typeof entry.locationLabel === "string" && entry.locationLabel.trim().length > 0
      ? { locationLabel: entry.locationLabel.trim() }
      : {}),
    ...(typeof entry.destinationId === "string" && entry.destinationId.trim().length > 0
      ? { destinationId: entry.destinationId.trim() }
      : {}),
    ...(photoIds != null ? { photoIds } : {}),
  };
}

function migrateLegacySegments(entry: Record<string, unknown>): DenaliItinerarySegment[] {
  if (Array.isArray(entry.segments)) {
    return entry.segments
      .map((segment) => parseSegmentEntry(segment))
      .filter((segment): segment is DenaliItinerarySegment => segment != null);
  }

  const legacyActivities =
    typeof entry.activities === "string" && entry.activities.trim().length > 0
      ? entry.activities.trim()
      : "";
  if (legacyActivities.length > 0) {
    return [
      {
        id: createDenaliItinerarySegmentId(),
        kind: "activity",
        title: legacyActivities,
        ...(typeof entry.locationText === "string" && entry.locationText.trim().length > 0
          ? { locationLabel: entry.locationText.trim() }
          : {}),
      },
    ];
  }

  return [];
}

export function parseDenaliItineraryDayEntry(
  value: unknown,
  index: number
): DenaliItineraryDay | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const dayNumber = readDayNumber(entry, index);
  const title = typeof entry.title === "string" ? entry.title : "";
  const summary =
    typeof entry.summary === "string"
      ? entry.summary
      : typeof entry.description === "string"
        ? entry.description
        : "";
  let segments = migrateLegacySegments(entry);
  if (segments.length === 0) {
    segments = [createEmptyDenaliItinerarySegment()];
  }
  return {
    dayNumber,
    title,
    ...(summary.trim().length > 0 ? { summary: summary.trim() } : {}),
    segments,
  };
}

export function parseDenaliItineraryDays(value: unknown): DenaliItineraryDay[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry, index) => parseDenaliItineraryDayEntry(entry, index))
    .filter((day): day is DenaliItineraryDay => day != null);
}

export function pruneItinerarySegmentPhotoIds(
  days: readonly DenaliItineraryDay[],
  allowedPhotoIds: ReadonlySet<string>
): DenaliItineraryDay[] {
  return days.map((day) => ({
    ...day,
    segments: day.segments.map((segment) => {
      const current = segment.photoIds;
      if (current == null || current.length === 0) {
        return segment;
      }
      const filtered = current.filter((id) => allowedPhotoIds.has(id));
      if (filtered.length === 0) {
        const { photoIds: _removed, ...rest } = segment;
        return rest;
      }
      if (filtered.length === current.length) {
        return segment;
      }
      return { ...segment, photoIds: filtered };
    }),
  }));
}

/** Rewire segment photoIds after clone photo remint (old id → new id). */
export function remapItinerarySegmentPhotoIds(
  days: readonly DenaliItineraryDay[],
  photoIdByOldId: ReadonlyMap<string, string>
): DenaliItineraryDay[] {
  if (photoIdByOldId.size === 0) {
    return [...days];
  }
  return days.map((day) => ({
    ...day,
    segments: day.segments.map((segment) => {
      const current = segment.photoIds;
      if (current == null || current.length === 0) {
        return segment;
      }
      let changed = false;
      const remapped = current.map((photoId) => {
        const nextId = photoIdByOldId.get(photoId);
        if (nextId != null && nextId !== photoId) {
          changed = true;
          return nextId;
        }
        return photoId;
      });
      return changed ? { ...segment, photoIds: remapped } : segment;
    }),
  }));
}

export function pruneItinerarySegmentDestinationIds(
  days: readonly DenaliItineraryDay[],
  allowedDestinationIds: ReadonlySet<string>
): DenaliItineraryDay[] {
  return days.map((day) => ({
    ...day,
    segments: day.segments.map((segment) => {
      const current = segment.destinationId;
      if (current == null || current.length === 0) {
        return segment;
      }
      if (allowedDestinationIds.has(current)) {
        return segment;
      }
      const { destinationId: _removed, ...rest } = segment;
      return rest;
    }),
  }));
}

export function syncDenaliItineraryRows(
  itinerary: readonly unknown[] | undefined,
  dayCount: number
): DenaliItineraryDay[] {
  const safeCount = Math.max(1, Math.min(Math.floor(dayCount), 60));
  const parsed = parseDenaliItineraryDays(itinerary ?? []);
  const byDay = new Map(parsed.map((row) => [row.dayNumber, row] as const));
  const next: DenaliItineraryDay[] = [];
  for (let dayNumber = 1; dayNumber <= safeCount; dayNumber += 1) {
    const prev = byDay.get(dayNumber);
    if (prev != null) {
      next.push({
        ...prev,
        dayNumber,
        segments: prev.segments.length > 0 ? [...prev.segments] : [createEmptyDenaliItinerarySegment()],
      });
      continue;
    }
    next.push({
      dayNumber,
      title: "",
      segments: [createEmptyDenaliItinerarySegment()],
    });
  }
  return next;
}

export function dayHasRequiredItineraryContent(day: DenaliItineraryDay): boolean {
  if (day.title.trim().length === 0) {
    return false;
  }
  return day.segments.some((segment) => segment.title.trim().length > 0);
}

export function collectDenaliItineraryDayValidationIssues(
  days: readonly DenaliItineraryDay[]
): readonly { readonly dayIndex: number; readonly segmentIndex?: number; readonly message: string }[] {
  const issues: { dayIndex: number; segmentIndex?: number; message: string }[] = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
    if (day == null) {
      continue;
    }
    if (day.title.trim().length === 0) {
      issues.push({
        dayIndex,
        message: "عنوان روز الزامی است.",
      });
    }
    const segmentIndex = day.segments.findIndex((segment) => segment.title.trim().length === 0);
    if (segmentIndex >= 0 && day.segments.every((segment) => segment.title.trim().length === 0)) {
      issues.push({
        dayIndex,
        segmentIndex: 0,
        message: "حداقل یک رویداد با عنوان برای هر روز الزامی است.",
      });
    }
  }
  return issues;
}
