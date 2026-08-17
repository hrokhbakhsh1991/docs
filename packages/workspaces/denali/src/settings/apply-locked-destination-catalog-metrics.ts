import { DENALI_DESTINATION_CATALOG_METRIC_BINDINGS } from "./destination-catalog-metric-bindings";
import {
  isDestinationCatalogMetricLocked,
  readLockedDestinationCatalogMetricValue,
} from "./resolve-destination-catalog-metric-lock";
import type { DestinationResource } from "../ui/adapters/catalog-types";
import { isDenaliWizardFieldVisibleOnDraft } from "../wizard/denali-wizard-field-visibility";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readDestinationId(data: Readonly<Record<string, unknown>>): string {
  const raw = data.destinationId;
  return typeof raw === "string" ? raw.trim() : "";
}

function parsePersistDestinationRow(
  row: Readonly<Record<string, unknown>>
): Pick<
  DestinationResource,
  "id" | "locationType" | "altitudeM" | "typicalTrailDistanceKm"
> | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    locationType: typeof row.locationType === "string" ? row.locationType : null,
    altitudeM:
      typeof row.altitudeM === "number" && Number.isFinite(row.altitudeM) ? row.altitudeM : null,
    typicalTrailDistanceKm:
      typeof row.typicalTrailDistanceKm === "number" && Number.isFinite(row.typicalTrailDistanceKm)
        ? row.typicalTrailDistanceKm
        : null,
  };
}

function toMetricSource(
  row: Pick<DestinationResource, "id" | "locationType" | "altitudeM" | "typicalTrailDistanceKm">
): DestinationResource {
  return {
    id: row.id,
    regionId: "",
    name: "",
    locationType: row.locationType,
    altitudeM: row.altitudeM,
    typicalTrailDistanceKm: row.typicalTrailDistanceKm,
    isActive: true,
    sortOrder: 0,
  };
}

function numericEquals(left: unknown, right: number): boolean {
  if (typeof left === "number" && Number.isFinite(left)) {
    return left === right;
  }
  if (typeof left === "string" && left.trim().length > 0) {
    const parsed = Number(left.trim());
    return Number.isFinite(parsed) && parsed === right;
  }
  return false;
}

function setOverviewMetric(
  data: Record<string, unknown>,
  field: "peakHeight" | "trailDistanceKm",
  value: number
): Record<string, unknown> {
  const tripDetails = isRecord(data.tripDetails) ? data.tripDetails : {};
  const overview = isRecord(tripDetails.overview) ? tripDetails.overview : {};
  if (numericEquals(overview[field], value)) {
    return data;
  }
  return {
    ...data,
    tripDetails: {
      ...tripDetails,
      overview: {
        ...overview,
        [field]: value,
      },
    },
  };
}

/**
 * ED-PEAK-LOCK-01 — persist-time catalog lock.
 * Overwrite locked metrics only. Unlocked / missing destination → leave operator values.
 */
export function applyLockedDestinationCatalogMetricsToCanonical(
  data: Readonly<Record<string, unknown>>,
  destinations?: readonly Readonly<Record<string, unknown>>[]
): Record<string, unknown> {
  if (destinations == null || destinations.length === 0) {
    return data as Record<string, unknown>;
  }
  const destinationId = readDestinationId(data);
  if (destinationId.length === 0) {
    return data as Record<string, unknown>;
  }
  const parsed = destinations
    .map(parsePersistDestinationRow)
    .find((row) => row != null && row.id === destinationId);
  if (parsed == null) {
    return data as Record<string, unknown>;
  }

  const destination = toMetricSource(parsed);
  const draft = { data };
  let next = data as Record<string, unknown>;

  for (const binding of Object.values(DENALI_DESTINATION_CATALOG_METRIC_BINDINGS)) {
    if (!isDenaliWizardFieldVisibleOnDraft(draft, binding.canonicalPath, "denali_basic")) {
      continue;
    }
    if (!isDestinationCatalogMetricLocked(destination, binding)) {
      continue;
    }
    const locked = readLockedDestinationCatalogMetricValue(destination, binding);
    const numeric = Number(locked);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }
    const field = binding.canonicalPath === "tripDetails.overview.peakHeight"
      ? "peakHeight"
      : "trailDistanceKm";
    next = setOverviewMetric(next, field, numeric);
  }

  return next;
}
