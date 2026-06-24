import type { DestinationResource, LocationsListResponse, RegionResource } from "./settings-module-types";

export function parseLocationsResponse(payload: unknown): LocationsListResponse {
  if (payload === null || typeof payload !== "object") {
    return { regions: [], destinations: [], total: 0 };
  }
  const record = payload as Record<string, unknown>;
  const regions = Array.isArray(record.regions)
    ? record.regions.filter((row): row is RegionResource => isRegion(row))
    : [];
  const destinations = Array.isArray(record.destinations)
    ? record.destinations.filter((row): row is DestinationResource => isDestination(row))
    : [];
  const total = typeof record.total === "number" ? record.total : regions.length + destinations.length;
  return { regions, destinations, total };
}

function isRegion(value: unknown): value is RegionResource {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string";
}

function isDestination(value: unknown): value is DestinationResource {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.regionId !== "string" ||
    typeof row.name !== "string"
  ) {
    return false;
  }
  if (
    row.altitudeM !== undefined &&
    row.altitudeM !== null &&
    typeof row.altitudeM !== "number"
  ) {
    return false;
  }
  if (row.altitudeM === undefined) {
    row.altitudeM = null;
  }
  if (
    row.typicalTrailDistanceKm !== undefined &&
    row.typicalTrailDistanceKm !== null &&
    typeof row.typicalTrailDistanceKm !== "number"
  ) {
    return false;
  }
  if (row.typicalTrailDistanceKm === undefined) {
    row.typicalTrailDistanceKm = null;
  }
  if (row.isActive === undefined) {
    row.isActive = true;
  }
  if (row.sortOrder === undefined) {
    row.sortOrder = 0;
  }
  return true;
}
