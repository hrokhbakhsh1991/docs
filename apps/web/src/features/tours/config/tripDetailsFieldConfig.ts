import {
  getTourFormProfileDescriptor,
  mountainOnlyTripDetailsOverviewFieldIds,
  TOUR_FORM_PROFILE_VALUES,
  type TourFormProfile,
} from "@repo/types";

import type { CoreFieldConfig } from "./editCoreFieldConfig";
import { getCoreFieldConfigForProfileBase } from "./editCoreFieldConfig";
import type { FieldConfigBase } from "./editFieldRbac";

/**
 * # Edit-side `TourFormProfile` → trip-details field-config matrix
 *
 * Phase P15 (promptq.md follow-up): this file was **slimmed** to hold **only** the
 * `tripDetails.*` inventory matrix. The RBAC framework (`resolveFieldAccess`,
 * `normalizeFieldUserRole`, shared types) now lives in {@link ./editFieldRbac}; the
 * `core.*` capacity matrix lives in {@link ./editCoreFieldConfig}.
 *
 * **Backward-compat re-exports:** everything that used to be imported from this module
 * for RBAC / core capacity still resolves here — downstream files can migrate imports
 * incrementally to the split modules.
 *
 * The adapter (`tripDetailsFieldConfigAdapter.ts`) layers `ProfileRules.getFieldRule` on
 * top of this base for any path registered in `BASE_FIELD_RULES`.
 *
 * **Mountain `mountain_outdoor` preset rows** (required / `"recommended"` tiers) live in
 * `packages/types/src/tour-form-profile-descriptors.ts` (`edit.tripDetailsPresetOverrides`)
 * and are materialised here at module init.
 *
 * ## Physical deletion blocker (honest status)
 *
 * Folding every row into `BASE_FIELD_RULES` is **not** a mechanical copy-paste — the Edit
 * widget uses a **different path namespace** than the wizard (`overview.shortIntro` vs
 * `overview.shortDescription`, `logistics.departureDate` vs `schedule.startDate`, …).
 * Unifying requires either (a) renaming the Edit DTO paths to match `TourCreateFormValues`,
 * or (b) maintaining an explicit path-alias map in the adapter. Neither was in scope for
 * P15 — this split only removes the RBAC + core concerns from this file so the next
 * rename slice has a smaller blast radius.
 */

export type {
  FieldConfigBase,
  FieldRequiredness,
  FieldRoleConstraint,
  FieldVisibility,
  ResolvedFieldAccess,
  UserRole,
} from "./editFieldRbac";
export {
  normalizeFieldUserRole,
  resolveFieldAccess,
} from "./editFieldRbac";

export type { CoreFieldConfig, CoreFieldId } from "./editCoreFieldConfig";
export { getCoreFieldConfigForProfileBase } from "./editCoreFieldConfig";

export type TripDetailsFieldId =
  | "overview.mainDestination"
  | "overview.destinationRegion"
  | "overview.tourThemeIds"
  | "overview.tripStyles"
  | "overview.difficultyLevel"
  | "overview.elevationGainMeters"
  | "overview.maxAltitudeMeters"
  | "overview.shortIntro"
  | "itinerary.highlights"
  | "itinerary.includedVisits"
  | "itinerary.excludedVisits"
  | "itinerary.optionalActivities"
  | "itinerary.outline"
  | "itinerary.programNotes"
  | "itinerary.specialExperiences"
  | "itinerary.dayPlans"
  | "logistics.meetingPoint"
  | "logistics.departureMeetingTime"
  | "logistics.departureDate"
  | "logistics.returnDate"
  | "logistics.returnPoint"
  | "logistics.transportationNotes"
  | "logistics.accommodationTypes"
  | "logistics.accommodationNotes"
  | "logistics.mealPlan"
  | "logistics.mealNotes"
  | "logistics.supportServices"
  | "logistics.includedServices"
  | "logistics.excludedServices"
  | "logistics.optionalServices"
  | "logistics.guideLanguageIds"
  | "logistics.groupSizeMin"
  | "logistics.groupSizeMax"
  | "participation.minimumAge"
  | "participation.maximumAge"
  | "participation.genderRestriction"
  | "participation.fitnessLevel"
  | "participation.experienceLevel"
  | "participation.technicalSkillRequired"
  | "participation.requirements"
  | "participation.skillsRequired"
  | "participation.gearRequiredIds"
  | "participation.gearOptionalIds"
  | "participation.documentsRequired"
  | "participation.suitableFor"
  | "participation.notSuitableFor"
  | "participation.medicalRestrictions"
  | "policies.reservationRules"
  | "policies.cancellationPolicy"
  | "policies.refundPolicy"
  | "policies.attendanceRules"
  | "policies.lateArrivalPolicy"
  | "policies.noShowPolicy"
  | "policies.confirmationPolicy"
  | "policies.capacityPolicy"
  | "policies.weatherPolicy"
  | "policies.safetyPolicy";

export type TripDetailsFieldConfig = FieldConfigBase & {
  id: TripDetailsFieldId;
};

export type ProfileFieldConfig = {
  profile: TourFormProfile;
  tripDetails: TripDetailsFieldConfig[];
  core: CoreFieldConfig[];
};

/** Ordered inventory of every row in the Edit trip-details matrix — exported for parity tests. */
export const TRIP_DETAILS_FIELD_IDS: readonly TripDetailsFieldId[] = [
  "overview.mainDestination",
  "overview.destinationRegion",
  "overview.tourThemeIds",
  "overview.tripStyles",
  "overview.difficultyLevel",
  "overview.elevationGainMeters",
  "overview.maxAltitudeMeters",
  "overview.shortIntro",
  "itinerary.highlights",
  "itinerary.includedVisits",
  "itinerary.excludedVisits",
  "itinerary.optionalActivities",
  "itinerary.outline",
  "itinerary.programNotes",
  "itinerary.specialExperiences",
  "itinerary.dayPlans",
  "logistics.meetingPoint",
  "logistics.departureMeetingTime",
  "logistics.departureDate",
  "logistics.returnDate",
  "logistics.returnPoint",
  "logistics.transportationNotes",
  "logistics.accommodationTypes",
  "logistics.accommodationNotes",
  "logistics.mealPlan",
  "logistics.mealNotes",
  "logistics.supportServices",
  "logistics.includedServices",
  "logistics.excludedServices",
  "logistics.optionalServices",
  "logistics.guideLanguageIds",
  "logistics.groupSizeMin",
  "logistics.groupSizeMax",
  "participation.minimumAge",
  "participation.maximumAge",
  "participation.genderRestriction",
  "participation.fitnessLevel",
  "participation.experienceLevel",
  "participation.technicalSkillRequired",
  "participation.requirements",
  "participation.skillsRequired",
  "participation.gearRequiredIds",
  "participation.gearOptionalIds",
  "participation.medicalRestrictions",
  "participation.documentsRequired",
  "participation.suitableFor",
  "participation.notSuitableFor",
  "policies.reservationRules",
  "policies.cancellationPolicy",
  "policies.refundPolicy",
  "policies.attendanceRules",
  "policies.lateArrivalPolicy",
  "policies.noShowPolicy",
  "policies.confirmationPolicy",
  "policies.capacityPolicy",
  "policies.weatherPolicy",
  "policies.safetyPolicy",
];

const NON_MOUNTAIN_HIDDEN_OVERRIDES: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> =
  Object.fromEntries(
    mountainOnlyTripDetailsOverviewFieldIds().map((id) => [
      id as TripDetailsFieldId,
      { visibility: "hidden" as const, requiredness: "optional" as const },
    ]),
  ) as Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>>;

const MOUNTAIN_OUTDOOR_OVERRIDES: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> =
  Object.fromEntries(
    getTourFormProfileDescriptor("mountain_outdoor").edit.tripDetailsPresetOverrides.map((o) => [
      o.id as TripDetailsFieldId,
      { visibility: o.visibility, requiredness: o.requiredness },
    ]),
  ) as Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>>;

function buildProfileTripDetailsConfig(
  overrides: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> = {},
): TripDetailsFieldConfig[] {
  return TRIP_DETAILS_FIELD_IDS.map((id) => ({
    id,
    ...(overrides[id] ?? { visibility: "editable", requiredness: "optional" }),
  }));
}

function buildProfileFieldConfig(profile: TourFormProfile): ProfileFieldConfig {
  const overrides =
    profile === "mountain_outdoor" ? MOUNTAIN_OUTDOOR_OVERRIDES : NON_MOUNTAIN_HIDDEN_OVERRIDES;
  return {
    profile,
    tripDetails: buildProfileTripDetailsConfig(overrides),
    core: getCoreFieldConfigForProfileBase(profile),
  };
}

const PROFILE_FIELD_CONFIGS: Record<TourFormProfile, ProfileFieldConfig> = Object.fromEntries(
  TOUR_FORM_PROFILE_VALUES.map((p) => [p, buildProfileFieldConfig(p)] as const),
) as Record<TourFormProfile, ProfileFieldConfig>;

/**
 * Base trip-details row matrix for the given profile, before the adapter overlays
 * `ProfileRules`. Callers outside `tripDetailsFieldConfigAdapter.ts` should consume the
 * adapter's `getTripDetailsFieldConfigForProfile` instead.
 */
export function getTripDetailsFieldConfigForProfileBase(
  profile: TourFormProfile,
): TripDetailsFieldConfig[] {
  return PROFILE_FIELD_CONFIGS[profile]?.tripDetails ?? PROFILE_FIELD_CONFIGS.general.tripDetails;
}
