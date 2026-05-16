export type {
  PhoneOtpLoginRequest,
  User,
  UserDto,
  WebSessionResponseDto,
} from "./auth";
export type {
  MeChangeMobileChallengeWire,
  MeEmailVerifiedWire,
  MeMobileChangedWire,
  MePatchSuccessWire,
  MePendingEmailVerificationWire,
  MeProfileGenderWire,
  MeProfileWire,
} from "./me";
export { ME_PROFILE_GENDER_VALUES } from "./me";
export type {
  Booking,
  BookingDto,
  LockedBookingPricingDto,
  RegistrationEntryMode,
  RegistrationPaymentStatus,
  RegistrationResponseDto,
  RegistrationStatus,
  RegistrationTransportMode,
} from "./registration";
export { TOUR_TYPES, type TourType } from "./tour-classification";
export {
  DEFAULT_TOUR_FORM_PROFILE,
  TOUR_FORM_PROFILE_VALUES,
  TOUR_FORM_PROFILE_VALUES_LIST,
  TOUR_FORM_PROFILE_VERSION,
  defaultTourFormProfileForTourType,
  isTourFormProfile,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "./tour-form-profile";
// `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` was relocated to `tour-form-profile-descriptors`
// in Phase P14; re-exported from the descriptor module below alongside the descriptor table.
// The `trip-details-inventory-policy.ts` module is preserved as a back-compat shim and is no
// longer the authoritative source — see the JSDoc on that file.
export {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
  type MountainOnlyTripDetailsOverviewKey,
} from "./tour-form-profile-descriptors";
export { normalizeLegacyOverviewTripStyleToTripStyles } from "./trip-details-legacy";
export {
  ACCOMMODATION_TYPE_VALUES,
  normalizeAccommodationTypesForDto,
  normalizeAccommodationTypesInput,
  parseLegacyAccommodationTypeString,
  type AccommodationTypeSlug
} from "./accommodation-types";
export {
  MEAL_PLAN_VALUES,
  normalizeMealPlanForDto,
  parseLegacyMealPlanString,
  type MealPlanSlug
} from "./meal-plan";
export type {
  DifficultyLevel,
  Tour,
  TourAudienceGroup,
  TourDetailsDto,
  TourDto,
  TourItineraryItem,
  TourLifecycleStatus,
  TourResponseDto,
  TourTripDetails,
  TourTripDetailsOverviewFields,
} from "./tour";
export { TOUR_AUDIENCE_GROUP_VALUES } from "./tour";
export type { WaitlistItemResponseDto, WaitlistItemStatus } from "./waitlist";
/**
 * # Legacy EventKind surface (Phase P8 — narrowed)
 *
 * **Only** the `Legacy` namespace is supported for `EventKind` and the sanctioned bridge
 * helpers:
 *
 *     import { Legacy } from "@repo/types";
 *     type K = Legacy.EventKind;
 *
 * Deprecated **top-level** re-exports (`EventKind`, `resolveEventKindFromTourContext`, …)
 * were removed after the in-repo migration — external BFFs must use `Legacy.*`.
 */
export * as Legacy from "./legacy";

export {
  DEFAULT_TOUR_DOMAIN_PROFILE,
  TOUR_DOMAIN_PROFILE_VALUES,
  URBAN_LOGISTICS_WHITELIST_KEYS,
  domainProfileFromTourTypeFallback,
  isTourDomainProfile,
  normalizeTourDomainProfileInput,
  type TourDomainProfile,
  type UrbanLogisticsWhitelistKey,
} from "./tour-domain-profile";
export {
  WIZARD_SUBMIT_REQUIRED_FIELD_PATHS,
  getRequiredSubmitFieldPathsForProfile,
  isWizardSubmitFieldRequiredForProfile,
  type WizardSubmitRequiredFieldPath,
  type WizardSubmitRequiredStepId,
} from "./tour-profile-submit-required";
export {
  TOUR_PATCH_FIELD_RULES,
  getForbiddenTourPatchDtoKeysForRole,
  type TourPatchDtoKey,
  type TourPatchFieldRule,
  type TourPatchViewerRole,
} from "./tour-patch-field-policy";
export { getEditRequiredTripDetailsPathsForProfile } from "./tour-profile-edit-required";
export {
  TOUR_FORM_PROFILE_DESCRIPTORS,
  getTourFormProfileDescriptor,
  mountainOnlyTripDetailsOverviewFieldIds,
  type EditTripDetailsOverrideRequiredness,
  type TourCreateRootSlug,
  type TourFormProfileDescriptor,
  type TourFormProfileEditHints,
  type TourFormProfileInvariantHints,
  type TourFormProfileStripDeltas,
  type WizardFieldGroupSlug,
} from "./tour-form-profile-descriptors";
