import type { DestinationResource } from "../ui/adapters/catalog-types";
import {
  normalizeDenaliDestinationLocationType,
  type DenaliDestinationLocationType,
} from "./destination-location-types";
import type { DenaliDestinationCatalogMetricBinding } from "./destination-catalog-metric-bindings";

function readPositiveCatalogMetric(
  destination: DestinationResource,
  catalogField: DenaliDestinationCatalogMetricBinding["catalogField"]
): number | null {
  const raw = destination[catalogField];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return raw;
}

export function formatDestinationCatalogMetricValue(
  value: number,
  binding: DenaliDestinationCatalogMetricBinding
): string {
  if (binding.inputMode === "digits") {
    return String(Math.trunc(value));
  }
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function isDestinationCatalogMetricLocked(
  destination: DestinationResource | undefined,
  binding: DenaliDestinationCatalogMetricBinding
): boolean {
  if (destination === undefined) {
    return false;
  }
  const locationType = normalizeDenaliDestinationLocationType(destination.locationType);
  if (locationType !== binding.locationType) {
    return false;
  }
  return readPositiveCatalogMetric(destination, binding.catalogField) != null;
}

export function readLockedDestinationCatalogMetricValue(
  destination: DestinationResource | undefined,
  binding: DenaliDestinationCatalogMetricBinding
): string {
  if (destination === undefined) {
    return "";
  }
  const metric = readPositiveCatalogMetric(destination, binding.catalogField);
  if (metric == null) {
    return "";
  }
  return formatDestinationCatalogMetricValue(metric, binding);
}

export function parseDestinationCatalogMetricPatchValue(
  raw: string,
  binding: DenaliDestinationCatalogMetricBinding
): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = binding.inputMode === "digits" ? Number.parseInt(trimmed, 10) : Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  if (binding.inputMode === "digits") {
    return Math.trunc(parsed);
  }
  return Math.round(parsed * 100) / 100;
}

export function destinationLocationTypeForMetric(
  binding: DenaliDestinationCatalogMetricBinding
): DenaliDestinationLocationType {
  return binding.locationType;
}
