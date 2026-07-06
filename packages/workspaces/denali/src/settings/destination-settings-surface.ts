import {
  DENALI_DESTINATION_LOCATION_TYPES,
  denaliDestinationMetadataFieldsForType,
  normalizeDenaliDestinationLocationType,
  type DenaliDestinationLocationType,
} from "./destination-location-types";

export type DenaliDestinationSettingsSurface = {
  readonly locationTypes: typeof DENALI_DESTINATION_LOCATION_TYPES;
  readonly normalizeLocationType: typeof normalizeDenaliDestinationLocationType;
  readonly metadataFieldsForType: typeof denaliDestinationMetadataFieldsForType;
};

export type { DenaliDestinationLocationType };

export const denaliDestinationSettingsSurface: DenaliDestinationSettingsSurface = Object.freeze({
  locationTypes: DENALI_DESTINATION_LOCATION_TYPES,
  normalizeLocationType: normalizeDenaliDestinationLocationType,
  metadataFieldsForType: denaliDestinationMetadataFieldsForType,
});
