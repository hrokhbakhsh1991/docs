export type PlatformItinerarySegment = {
  readonly destination?: string;
  readonly notes?: string;
};

export type PlatformItineraryDay = {
  readonly dayIndex: number;
  readonly title?: string;
  readonly segments?: readonly PlatformItinerarySegment[];
};

export type PlatformItineraryData = {
  readonly days: readonly PlatformItineraryDay[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parsePlatformItineraryData(value: unknown): PlatformItineraryData {
  if (!isRecord(value) || !Array.isArray(value.days)) {
    return { days: [] };
  }
  const days: PlatformItineraryDay[] = [];
  for (const entry of value.days) {
    if (!isRecord(entry)) {
      continue;
    }
    const dayIndex =
      typeof entry.dayIndex === "number" && Number.isFinite(entry.dayIndex)
        ? entry.dayIndex
        : days.length + 1;
    const title = typeof entry.title === "string" ? entry.title : undefined;
    const segmentsRaw = entry.segments;
    const segments: PlatformItinerarySegment[] = [];
    if (Array.isArray(segmentsRaw)) {
      for (const segment of segmentsRaw) {
        if (!isRecord(segment)) {
          continue;
        }
        segments.push({
          destination:
            typeof segment.destination === "string" ? segment.destination : undefined,
          notes: typeof segment.notes === "string" ? segment.notes : undefined,
        });
      }
    }
    days.push({ dayIndex, title, segments });
  }
  return { days };
}

export function serializePlatformItineraryData(data: PlatformItineraryData): Record<string, unknown> {
  return {
    days: data.days.map((day) => ({
      dayIndex: day.dayIndex,
      ...(day.title !== undefined && day.title.length > 0 ? { title: day.title } : {}),
      segments: (day.segments ?? []).map((segment) => ({
        ...(segment.destination !== undefined && segment.destination.length > 0
          ? { destination: segment.destination }
          : {}),
        ...(segment.notes !== undefined && segment.notes.length > 0 ? { notes: segment.notes } : {}),
      })),
    })),
  };
}

export function appendPlatformItineraryDay(
  data: PlatformItineraryData
): PlatformItineraryData {
  const nextIndex =
    data.days.length === 0
      ? 1
      : Math.max(...data.days.map((day) => day.dayIndex)) + 1;
  return {
    days: [...data.days, { dayIndex: nextIndex, title: "", segments: [{ destination: "", notes: "" }] }],
  };
}
