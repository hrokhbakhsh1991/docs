/**
 * Phase 4 migration step 1: canonical model introduced, not wired yet.
 * Phase 4 step 2: consumed by web rule adapter (`getDenaliRulesFromCanonical`) — UI not switched.
 */

export {
  DENALI_LOCATION_ZONE_KEYS,
  denaliLocationAddressText,
  denaliLocationFromApi,
  denaliLocationFromText,
  type DenaliLocationData,
  type DenaliLocationZoneKey,
} from "./locationData";

export {
  EMPTY_GATHERING_PICKUP_STATION,
  gatheringPickupStationFromLegacyLocation,
  gatheringPickupStationIsConcrete,
  gatheringPickupStationToPersisted,
  normalizeGatheringPickupStation,
  normalizeGatheringPickupStations,
  type DenaliGatheringPickupStation,
} from "./gatheringPickupStation";

export {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
  type DenaliCanonicalCategory,
  type DenaliCanonicalDuration,
  type DenaliCanonicalTourModel,
  type DenaliCanonicalTransportMode,
} from "./denaliCanonicalTourModel";

export {
  denaliCanonicalFromForm,
  type DenaliWizardFormLike,
} from "./denaliCanonicalFromForm";

export {
  denaliFormAmountToCanonical,
  denaliFormCapacityMaxToCanonical,
  isDenaliPositiveInt,
} from "./denaliNumericFields";

export {
  isDenaliAllowPersonalCarVisible,
  isDenaliOrganizedBusTransportMode,
  isDenaliOrganizedTransportMode,
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountRequired,
  isDenaliTransportDongAmountVisible,
} from "./denaliTransportRules";
