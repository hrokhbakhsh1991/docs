import type { EventKind } from "./tour-kind";
import type { TourDomainProfile } from "./tour-domain-profile";

/**
 * **Official one-way projection** from canonical {@link TourDomainProfile} to the
 * legacy {@link EventKind} surface, still consumed by the flat Edit form
 * (`apps/web/src/components/tours/TourForm.tsx`) and the shared
 * `tour-create-trip-details-fields.tsx` widget.
 *
 * Phase C status: this is the **only** sanctioned way to obtain an `EventKind` for
 * new code. After Phase B, the Edit Zod resolver uses this function (via
 * `domainProfileFromEditFormValues` → `eventKindForDomainProfile`) whenever a theme
 * catalog is loaded; the legacy `resolveEventKindFromTourContext` resolver is only
 * the no-catalog fallback and is staged for removal in Phase D.
 *
 * Many-to-one and lossy by design — `nature_trip` and `cinema_event` have no native
 * `EventKind`. In practice the only fork in `tripDetailsFieldConfig.ts` is
 * `"mountain"` vs everything-else, so the lossiness does not change visible
 * required-ness/visibility today (all non-mountain kinds share the same `tripDetails`
 * field matrix). The projection is total over {@link TourDomainProfile} so consumers
 * never need a fallback.
 */
export function eventKindForDomainProfile(profile: TourDomainProfile): EventKind {
  switch (profile) {
    case "mountain_outdoor":
      return "mountain";
    case "cultural_tour":
      return "cultural";
    case "urban_event":
      return "city_tour";
    case "cinema_event":
      return "workshop";
    case "nature_trip":
      return "generic";
    case "general":
      return "generic";
  }
}

/*
 * NOTE — `domainProfileFromEventKindBestEffort` (the transitional reverse projection
 * `EventKind → TourDomainProfile`) was removed in **Phase P5** (promptq.md). It carried
 * zero production callers and a lossy round-trip (`"generic" → "general"` collapses the
 * `"nature_trip"` axis). New code MUST resolve the canonical {@link TourDomainProfile}
 * directly via `resolveTourFormProfileForTourFormValues` (web) or
 * `resolveTourFormProfileFromTripDetails` (api). Do not reintroduce this helper.
 */
