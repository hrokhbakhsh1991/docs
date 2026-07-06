export type DestinationLocationType = "generic" | "peak" | "nature_trail";

export type DestinationMetadataField = "altitudeM" | "typicalTrailDistanceKm";

export type DestinationLocationTypeEntry = {
  readonly value: DestinationLocationType;
  readonly metadataFields: readonly DestinationMetadataField[];
  readonly settingsLabelKey: string;
};

export type DestinationSettingsSurface = {
  readonly locationTypes: readonly DestinationLocationTypeEntry[];
  readonly normalizeLocationType: (
    value: string | null | undefined
  ) => DestinationLocationType;
  readonly metadataFieldsForType: (
    locationType: DestinationLocationType
  ) => readonly DestinationMetadataField[];
};
