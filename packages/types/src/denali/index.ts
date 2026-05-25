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
  DENALI_TEMPLATE_SCHEMA_VERSION,
  type DenaliCanonicalTemplateData,
  type DenaliTemplateSchema,
  type DenaliTemplateSchemaField,
  type DenaliTemplateSchemaModel,
} from "./denaliTemplateSchema";

export {
  DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS,
  TEMPLATE_SCHEMA_ALIGNED_WITH_CANONICAL_MODEL,
  validateDenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateValidationIssue,
  type DenaliCanonicalTemplateValidationResult,
} from "./validateCanonicalTemplateData";

export type {
  StoredWorkspaceTourTemplateRow,
  WorkspaceTourTemplateRecord,
} from "./workspaceTourTemplate";

export {
  canonicalToTemplate,
  collectDiscardedTemplateKeys,
  sanitizeDenaliCanonicalTemplateData,
  storedTemplateRowIsLegacy,
  templateToCanonical,
  type CleanupLegacyTemplatesReport,
} from "./templateCanonicalMapping";

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
  isDenaliAdminCapacityApprovalVisible,
  isDenaliAllowPersonalCarVisible,
  isDenaliOrganizedBusTransportMode,
  isDenaliOrganizedTransportMode,
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountRequired,
  isDenaliTransportDongAmountVisible,
  isDenaliSeatPreferenceRequired,
  isDenaliSeatPreferenceVisible,
} from "./denaliTransportRules";

