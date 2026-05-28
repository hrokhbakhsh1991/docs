import {
  DEFAULT_TOUR_FORM_PROFILE,
  TOUR_FORM_PROFILE_VALUES,
  defaultTourFormProfileForTourType,
  isTourFormProfile,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "./tour-form-profile";
import type { TourType } from "./tour-classification";

/**
 * Canonical, domain-level tour classification.
 *
 * Today this is a typed alias of {@link TourFormProfile} — same closed set, same DB
 * value, same wire format on `tours.form_profile_snapshot` and
 * `workspace_tour_themes.form_profile`.
 *
 * The alias exists to express intent at the call site:
 *
 *  - `TourFormProfile`   → "I'm choosing wizard layout / per-step rules."
 *  - `TourDomainProfile` → "I'm working on canonical classification — server strip,
 *                          business invariants, field access in any UI surface."
 *
 * Both names compile to the same type. If wizard layout ever needs to decouple from
 * business classification, this is the type that stays on disk + API and
 * `TourFormProfile` becomes a derived UI view.
 *
 * @see ./tour-domain-profile-bridge for the legacy {@link EventKind} projection.
 */
export type TourDomainProfile = TourFormProfile;

/** Same closed set as {@link TOUR_FORM_PROFILE_VALUES}; re-exported under the canonical name. */
export const TOUR_DOMAIN_PROFILE_VALUES = TOUR_FORM_PROFILE_VALUES;

export const DEFAULT_TOUR_DOMAIN_PROFILE: TourDomainProfile = DEFAULT_TOUR_FORM_PROFILE;

/** Alias of {@link isTourFormProfile}; predicate for the canonical type. */
export const isTourDomainProfile: (value: unknown) => value is TourDomainProfile = isTourFormProfile;

/** Alias of {@link normalizeTourFormProfileInput}; coerces unknown inputs to a valid value. */
export const normalizeTourDomainProfileInput: (_value: unknown) => TourDomainProfile =
  normalizeTourFormProfileInput;

/**
 * Canonical fallback from commercial {@link TourType} to {@link TourDomainProfile} when
 * no theme has been picked (mirrors {@link defaultTourFormProfileForTourType}).
 *
 * Used by both the web wizard (`resolveTourFormProfile`) and the api strip
 * (`resolveTourFormProfileFromTripDetails`); exposed under the canonical name so new
 * call sites can express intent.
 */
export const domainProfileFromTourTypeFallback: (
  _tourType: TourType | null | undefined,
) => TourDomainProfile = defaultTourFormProfileForTourType;

/**
 * Logistics keys that survive the `urban_event` profile strip on both client and server.
 *
 * Canonical (single source of truth) for:
 *  - `apps/web/src/features/tours/domain/stripTourFormTripDetailsForProfile.ts`
 *  - `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`
 *  - `apps/api/src/modules/tours/utils/assert-create-tour-invariants.ts`
 *
 * Closes part of the mismatch documented as M-6 in the unified-domain discovery
 * report. New profile-specific whitelists / strip data tables should land here too.
 *
 * Order is alphabetical for stable iteration in tests / snapshots.
 */
export const URBAN_LOGISTICS_WHITELIST_KEYS = [
  "departureDate",
  "departureMeetingTime",
  "meetingPoint",
  "returnDate",
  "returnPoint",
] as const;

export type UrbanLogisticsWhitelistKey = (typeof URBAN_LOGISTICS_WHITELIST_KEYS)[number];
