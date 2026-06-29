import { getCanonicalValue, type FieldDefinition, type FieldPolicyEntityState } from "@app-tour/platform-core";

export type CanonicalDeliveryPayload = {
  /** Eligible field ids mapped to resolved delivery-safe string values. */
  readonly fieldValues: Readonly<Record<string, string>>;
};

export type EnrichCanonicalDeliveryPayloadInput = {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly eligibleFieldIds: readonly string[];
  readonly definitions: readonly FieldDefinition[];
  /** Reserved for future entity lookups; not used by path-only enrichment today. */
  readonly entityState?: FieldPolicyEntityState;
};

/** Denali composite location field — renders all populated trip zones in selection order. */
const DENALI_LOCATION_ZONES_FIELD_ID = "denali.location-zones";
const DENALI_LOCATION_ZONE_PATHS = ["startPoint", "summitPoint", "campPoint", "endPoint"] as const;

function coerceLocationDataToDeliveryString(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (label.length > 0) {
    return label;
  }
  const address = typeof record.address === "string" ? record.address.trim() : "";
  return address.length > 0 ? address : undefined;
}

function coerceToDeliveryString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return coerceLocationDataToDeliveryString(value);
}

/**
 * Aggregates the Denali location-zone composite (start/summit/camp/end) into a single
 * comma-joined delivery value. Empty zones are skipped; returns undefined when none are set.
 */
function resolveDenaliLocationZonesDeliveryValue(
  payload: Readonly<Record<string, unknown>>,
): string | undefined {
  const labels: string[] = [];
  for (const zonePath of DENALI_LOCATION_ZONE_PATHS) {
    const label = coerceLocationDataToDeliveryString(getCanonicalValue(payload, zonePath));
    if (label !== undefined && !labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels.length > 0 ? labels.join("، ") : undefined;
}

/**
 * Resolves a human-facing delivery value for reference ids (e.g. `destinationId` → `destination.name`).
 * Workspace-agnostic: uses canonical companion paths only — no provider or catalog HTTP.
 */
function resolveCanonicalDeliveryValue(
  payload: Readonly<Record<string, unknown>>,
  canonicalPath: string,
): string | undefined {
  if (canonicalPath.endsWith("Id") && canonicalPath.length > 2) {
    const base = canonicalPath.slice(0, -2);
    const displayValue = coerceToDeliveryString(getCanonicalValue(payload, `${base}.name`));
    if (displayValue !== undefined) {
      return displayValue;
    }
  }

  return coerceToDeliveryString(getCanonicalValue(payload, canonicalPath));
}

/**
 * Pure canonical enrichment stage: maps eligible field ids to resolved string values.
 * No FieldPolicy, provider formatting, or outbound HTTP.
 */
export function enrichCanonicalDeliveryPayload(
  input: EnrichCanonicalDeliveryPayloadInput,
): CanonicalDeliveryPayload {
  const canonicalPathById = new Map(
    input.definitions.map((definition) => [definition.id, definition.canonicalPath] as const),
  );
  const values: Record<string, string> = {};

  for (const fieldId of input.eligibleFieldIds) {
    if (fieldId === DENALI_LOCATION_ZONES_FIELD_ID) {
      const zonesValue = resolveDenaliLocationZonesDeliveryValue(input.payload);
      if (zonesValue !== undefined) {
        values[fieldId] = zonesValue;
      }
      continue;
    }
    const canonicalPath = canonicalPathById.get(fieldId);
    if (canonicalPath === undefined) {
      continue;
    }
    const value = resolveCanonicalDeliveryValue(input.payload, canonicalPath);
    if (value !== undefined) {
      values[fieldId] = value;
    }
  }

  return { fieldValues: values };
}
