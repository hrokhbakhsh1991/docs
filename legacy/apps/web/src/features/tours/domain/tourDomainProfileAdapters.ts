import {
  Legacy,
  domainProfileFromTourTypeFallback,
  type TourDomainProfile,
  type TourType,
} from "@repo/types";

type EventKind = Legacy.EventKind;
const { eventKindForDomainProfile, resolveEventKindFromTourContext } = Legacy;

import {
  resolveTourFormProfileForTourFormValues,
  type ThemeRowForProfile,
} from "@/features/tours/wizard/tourWizardProfileResolve";

/**
 * Edit-side **adapter** between canonical `TourDomainProfile` (`@repo/types`) and legacy
 * `EventKind` inputs used by the trip-details matrix and telemetry.
 *
 * - `domainProfileFromEditFormValues` — same `TourDomainProfile` as `resolveTourFormProfileForTourFormValues`
 *   when a theme catalog exists; otherwise `domainProfileFromTourTypeFallback(tourType)`.
 * - `legacyEventKindFromEditFormValues` — single entry point for `resolveEventKindFromTourContext`
 *   on Edit (compatibility / no-catalog paths).
 * - `dualClassificationForEditForm` — exposes legacy vs `eventKindForDomainProfile(domainProfile)`
 *   and `agrees` for observability without changing default resolver behavior elsewhere.
 */

export type EditFormClassificationInput = {
  /** Workspace theme catalog used to look up `formProfile` for the picked theme. */
  themeCatalog: readonly ThemeRowForProfile[] | undefined;
  /** Watched form value for the commercial tour type. */
  tourType: TourType | undefined;
  /**
   * Trimmed primary theme id from `tripDetails.overview.tourThemeIds[0]`. Empty / undefined
   * means "no theme picked yet" (falls through to the tourType fallback).
   */
  mainTourThemeId: string | undefined;
  /** Watched legacy `tripDetails.overview.tripStyles[]` (drives legacy `EventKind` resolver). */
  tripStyles: readonly string[] | undefined;
};

/**
 * Canonical {@link TourDomainProfile} resolver for the Edit form. Wraps
 * {@link resolveTourFormProfileForTourFormValues} so callers see the canonical
 * alias name and never have to deal with `undefined` (we fall through to the
 * commercial-tourType default).
 */
export function domainProfileFromEditFormValues(
  input: EditFormClassificationInput,
): TourDomainProfile {
  if (input.themeCatalog && input.themeCatalog.length > 0) {
    return resolveTourFormProfileForTourFormValues({
      themeCatalog: [...input.themeCatalog],
      tourType: input.tourType,
      mainTourThemeId: input.mainTourThemeId,
    });
  }
  return domainProfileFromTourTypeFallback(input.tourType ?? null);
}

/**
 * Legacy `EventKind` resolver for Edit. Delegates to `resolveEventKindFromTourContext`.
 *
 * Phase P7 (promptq.md): the Edit resolver no longer reads this directly — it always
 * routes through `domainProfileFromEditFormValues(...) → eventKindForDomainProfile(...)`.
 * The only remaining caller is `dualClassificationForEditForm` below, which uses it to
 * compute the legacy-vs-projected `agrees` boolean for drift telemetry, and the
 * `LEGACY_EDIT_RESOLVER_ENABLED` kill switch path (single-cycle escape hatch).
 *
 * Removal target: Phase P8, alongside narrowing the `@repo/types` `EventKind` public
 * surface. Do **not** add new call sites.
 *
 * @deprecated Retained only for drift telemetry + emergency kill-switch fallback.
 */
export function legacyEventKindFromEditFormValues(
  input: Pick<EditFormClassificationInput, "tourType" | "tripStyles">,
): EventKind {
  return resolveEventKindFromTourContext({
    tourType: input.tourType,
    tripStyles: input.tripStyles ?? undefined,
  });
}

export type EditFormDualClassification = {
  /** Canonical profile for strip alignment and wizard parity flags. */
  readonly domainProfile: TourDomainProfile;
  /** Legacy matrix key from `tripDetailsFieldConfig` until that layer is profile-native. */
  readonly legacyEventKind: EventKind;
  /** `eventKindForDomainProfile(domainProfile)` — compatibility projection for convergence checks. */
  readonly projectedEventKind: EventKind;
  /**
   * `true` when legacy resolver and profile projection agree (workspace `formProfile` consistent
   * with commercial `tourType` / `tripStyles`). When `false`, telemetry records drift; default
   * Edit behavior still follows the feature-flagged resolver path.
   */
  readonly agrees: boolean;
};

/**
 * Combined classification snapshot for the Edit form. Returns both axes plus the
 * unified projection so the form can drive its existing legacy code paths while
 * carrying the canonical {@link TourDomainProfile} forward unchanged.
 */
export function dualClassificationForEditForm(
  input: EditFormClassificationInput,
): EditFormDualClassification {
  const domainProfile = domainProfileFromEditFormValues(input);
  const legacyEventKind = legacyEventKindFromEditFormValues(input);
  const projectedEventKind = eventKindForDomainProfile(domainProfile);
  return {
    domainProfile,
    legacyEventKind,
    projectedEventKind,
    agrees: legacyEventKind === projectedEventKind,
  };
}
