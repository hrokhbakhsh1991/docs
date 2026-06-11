export type DenaliItineraryDay = {
  readonly dayNumber?: number;
  readonly title?: string;
  readonly description?: string;
};

export function parseDenaliItineraryDays(value: unknown): DenaliItineraryDay[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry, index) => ({
      dayNumber:
        typeof entry.dayNumber === "number" && Number.isFinite(entry.dayNumber)
          ? Math.floor(entry.dayNumber)
          : index + 1,
      ...(typeof entry.title === "string" ? { title: entry.title } : {}),
      ...(typeof entry.description === "string" ? { description: entry.description } : {}),
    }));
}

export function buildDefaultItineraryDays(dayCount: number): DenaliItineraryDay[] {
  const count = Math.max(1, Math.floor(dayCount));
  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    title: "",
    description: "",
  }));
}
