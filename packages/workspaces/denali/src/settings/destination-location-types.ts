export const DENALI_DESTINATION_LOCATION_TYPE_PEAK = "peak" as const;
export const DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL = "nature_trail" as const;
export const DENALI_DESTINATION_LOCATION_TYPE_GENERIC = "generic" as const;

export const DENALI_DESTINATION_LOCATION_TYPES = Object.freeze([
  Object.freeze({
    value: DENALI_DESTINATION_LOCATION_TYPE_GENERIC,
    metadataFields: Object.freeze([] as const),
    settingsLabelKey: "locationTypeGeneric",
  }),
  Object.freeze({
    value: DENALI_DESTINATION_LOCATION_TYPE_PEAK,
    metadataFields: Object.freeze(["altitudeM"] as const),
    settingsLabelKey: "locationTypePeak",
  }),
  Object.freeze({
    value: DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL,
    metadataFields: Object.freeze(["typicalTrailDistanceKm"] as const),
    settingsLabelKey: "locationTypeNatureTrail",
  }),
]);

export type DenaliDestinationLocationType =
  (typeof DENALI_DESTINATION_LOCATION_TYPES)[number]["value"];

export type DenaliDestinationMetadataField =
  (typeof DENALI_DESTINATION_LOCATION_TYPES)[number]["metadataFields"][number];

const LOCATION_TYPE_SET = new Set(
  DENALI_DESTINATION_LOCATION_TYPES.map((entry) => entry.value)
);

export function normalizeDenaliDestinationLocationType(
  value: string | null | undefined
): DenaliDestinationLocationType {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return DENALI_DESTINATION_LOCATION_TYPE_GENERIC;
  }
  return LOCATION_TYPE_SET.has(trimmed as DenaliDestinationLocationType)
    ? (trimmed as DenaliDestinationLocationType)
    : DENALI_DESTINATION_LOCATION_TYPE_GENERIC;
}

export function denaliDestinationMetadataFieldsForType(
  locationType: string | null | undefined
): readonly DenaliDestinationMetadataField[] {
  const normalized = normalizeDenaliDestinationLocationType(locationType);
  const entry = DENALI_DESTINATION_LOCATION_TYPES.find((row) => row.value === normalized);
  return entry?.metadataFields ?? [];
}
