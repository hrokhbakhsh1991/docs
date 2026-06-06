/**
 * Trunk shim for legacy `@repo/types` (Phase 6.2 — no runtime legacy import).
 */

export {
  DENALI_TOUR_KIND_VALUES,
  type DenaliTourKind,
  denaliTourKindToIsMultiDay,
  isDenaliEventTourKind,
  isDenaliOutdoorTourKind,
  isDenaliTourKind,
} from "./denali-tour-kind";

export {
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  DENALI_EVENT_VARIANT_VALUES,
  type DenaliCanonicalBasicsSelection,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
  denaliCanonicalBasicsFromTourKind,
  denaliCategoryRequiresEventVariant,
  denaliTourKindFromCanonical,
  isDenaliMountainCategory,
  isDenaliOutdoorCategory,
} from "./denali-canonical-basics";

export {
  TOUR_FORM_PROFILE_VALUES,
  type TourFormProfile,
  DEFAULT_TOUR_FORM_PROFILE,
  isTourFormProfile,
} from "./tour-form-profile";
