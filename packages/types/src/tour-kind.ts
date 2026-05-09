export type EventKind = "generic" | "mountain" | "cultural" | "city_tour" | "workshop";

export type EventKindResolverInput = {
  tourType?: string | null;
  eventKind?: string | null;
  tripStyle?: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Shared v1 mapper from legacy classification fields to canonical event kind.
 * Unknown inputs intentionally collapse to `generic` for backwards compatibility.
 */
export function resolveEventKindFromTourContext(input: EventKindResolverInput): EventKind {
  const explicitKind = normalize(input.eventKind);
  if (
    explicitKind === "generic" ||
    explicitKind === "mountain" ||
    explicitKind === "cultural" ||
    explicitKind === "city_tour" ||
    explicitKind === "workshop"
  ) {
    return explicitKind;
  }

  const tourType = normalize(input.tourType);
  if (tourType === "mountain") return "mountain";
  if (tourType === "city") return "city_tour";
  if (tourType === "camp" || tourType === "desert") return "generic";
  if (tourType === "other") return "generic";

  const tripStyle = normalize(input.tripStyle);
  if (tripStyle === "mountaineering" || tripStyle === "mountain") return "mountain";
  if (tripStyle === "cultural") return "cultural";
  if (tripStyle === "city") return "city_tour";

  return "generic";
}

