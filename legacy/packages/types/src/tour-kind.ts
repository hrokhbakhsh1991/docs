/**
 * Legacy **EventKind** compatibility surface (Phase 5 sunset).
 *
 * - **Do not** use `EventKind` for product behavior — classify with `TourFormProfile` /
 *   `TourDomainProfile` and enforce with ProfileRules (web) + profile strip/invariants (API).
 * - **Do** keep this module for: Edit-form legacy inputs, external API payloads that still send
 *   `eventKind` / old `tourType` hints, analytics projections, and the
 *   `tour-domain-profile-bridge` module.
 *
 * @see docs/PROFILE_ARCHITECTURE_PLAYBOOK.md — EventKind sunset boundaries.
 */
export type EventKind = "generic" | "mountain" | "cultural" | "city_tour" | "workshop";

export type EventKindResolverInput = {
  tourType?: string | null;
  eventKind?: string | null;
  /**
   * Legacy singular execution/category hint on this resolver input only (distinct from
   * `tripDetails.overview.tripStyles` in stored JSON).
   */
  tripStyle?: string | null;
  /** New multi-select field. New values are orthogonal and never drive kind. */
  tripStyles?: readonly (string | null | undefined)[] | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function legacyTripStyleToKind(value: string): EventKind | undefined {
  if (value === "mountaineering" || value === "mountain") return "mountain";
  if (value === "cultural") return "cultural";
  if (value === "city") return "city_tour";
  return undefined;
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

  // Primary signal: `tourType`. Modern `tripStyles[]` execution-style slugs are orthogonal and
  // not read here. Legacy singular `tripStyle` on this input + category-like entries in
  // `tripStyles[]` still participate in the fallbacks below for old payloads.
  const tourType = normalize(input.tourType);
  if (tourType === "mountain") return "mountain";
  if (tourType === "city") return "city_tour";
  if (tourType === "cultural") return "cultural";
  if (tourType === "nature" || tourType === "desert") return "generic";

  // Backward compatibility with rows written before
  // migration `1777591000000-RefineTourTypeEnum`.
  if (tourType === "camp" || tourType === "other") return "generic";

  // Legacy singular `tripStyle` on this input (pre-refactor stored shape) used category-like values.
  // Honor them so historical JSONB data still resolves to a sensible kind.
  const legacyFromSingle = legacyTripStyleToKind(normalize(input.tripStyle));
  if (legacyFromSingle) return legacyFromSingle;

  // Same legacy semantics inside a `tripStyles[]` array (rare: only if a
  // migration script ever folded an old singular value into the new field).
  if (Array.isArray(input.tripStyles)) {
    for (const raw of input.tripStyles) {
      const fromArray = legacyTripStyleToKind(normalize(raw));
      if (fromArray) return fromArray;
    }
  }

  return "generic";
}

