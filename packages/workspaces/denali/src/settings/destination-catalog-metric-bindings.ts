import {
  DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL,
  DENALI_DESTINATION_LOCATION_TYPE_PEAK,
  type DenaliDestinationLocationType,
} from "./destination-location-types";

export type DenaliDestinationCatalogMetricCanonicalPath =
  | "tripDetails.overview.peakHeight"
  | "tripDetails.overview.trailDistanceKm";

export type DenaliDestinationCatalogMetricBinding = {
  readonly canonicalPath: DenaliDestinationCatalogMetricCanonicalPath;
  readonly locationType: DenaliDestinationLocationType;
  readonly catalogField: "altitudeM" | "typicalTrailDistanceKm";
  readonly patchField: "altitudeM" | "typicalTrailDistanceKm";
  readonly inputMode: "digits" | "decimal";
};

export const DENALI_DESTINATION_CATALOG_METRIC_BINDINGS: Readonly<
  Record<DenaliDestinationCatalogMetricCanonicalPath, DenaliDestinationCatalogMetricBinding>
> = Object.freeze({
  "tripDetails.overview.peakHeight": Object.freeze({
    canonicalPath: "tripDetails.overview.peakHeight",
    locationType: DENALI_DESTINATION_LOCATION_TYPE_PEAK,
    catalogField: "altitudeM",
    patchField: "altitudeM",
    inputMode: "digits",
  }),
  "tripDetails.overview.trailDistanceKm": Object.freeze({
    canonicalPath: "tripDetails.overview.trailDistanceKm",
    locationType: DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL,
    catalogField: "typicalTrailDistanceKm",
    patchField: "typicalTrailDistanceKm",
    inputMode: "decimal",
  }),
});

export function resolveDenaliDestinationCatalogMetricBinding(
  canonicalPath: string
): DenaliDestinationCatalogMetricBinding | null {
  return (
    DENALI_DESTINATION_CATALOG_METRIC_BINDINGS[
      canonicalPath as DenaliDestinationCatalogMetricCanonicalPath
    ] ?? null
  );
}
