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
  /** Catalog-resolved display strings keyed by canonical path (for example `destinationId`). */
  readonly referenceDisplayValues?: Readonly<Record<string, string>>;
};

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})/;
const DELIVERY_DATE_TIME_LOCALE = "fa-IR";
const DELIVERY_DATE_TIME_TIME_ZONE = "Asia/Tehran";

/** Denali composite location field — renders all populated trip zones in selection order. */
const DENALI_LOCATION_ZONES_FIELD_ID = "denali.location-zones";
const DENALI_LOCATION_ZONE_PATHS = ["startPoint", "summitPoint", "campPoint", "endPoint"] as const;
/** Ghost dependents persist here after form-profile strip (ED-CAMP-PERSIST-01). */
const DENALI_LOCATION_ZONE_OVERVIEW_PREFIX = "tripDetails.overview";

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

function formatDeliveryDateTimeString(value: string, includeTime: boolean): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return trimmed;
  }
  return new Intl.DateTimeFormat(DELIVERY_DATE_TIME_LOCALE, {
    timeZone: DELIVERY_DATE_TIME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(parsed));
}

function coerceToDeliveryString(
  value: unknown,
  options?: { readonly kind?: FieldDefinition["kind"] },
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    if (options?.kind === "date" || ISO_DATE_TIME_PATTERN.test(trimmed)) {
      return formatDeliveryDateTimeString(trimmed, trimmed.includes("T"));
    }
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return coerceLocationDataToDeliveryString(value);
}

/**
 * Root zone first (startPoint anchor / in-session ghosts); empty root falls back to
 * `tripDetails.overview.{path}` after INV-DENALI-WIZ-003 ghost strip.
 */
function resolveDenaliLocationZoneDeliveryString(
  payload: Readonly<Record<string, unknown>>,
  zonePath: (typeof DENALI_LOCATION_ZONE_PATHS)[number],
): string | undefined {
  const fromRoot = coerceLocationDataToDeliveryString(getCanonicalValue(payload, zonePath));
  if (fromRoot !== undefined) {
    return fromRoot;
  }
  return coerceLocationDataToDeliveryString(
    getCanonicalValue(payload, `${DENALI_LOCATION_ZONE_OVERVIEW_PREFIX}.${zonePath}`),
  );
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
    const label = resolveDenaliLocationZoneDeliveryString(payload, zonePath);
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
  options: {
    readonly kind?: FieldDefinition["kind"];
    readonly referenceDisplayValues?: Readonly<Record<string, string>>;
  } = {},
): string | undefined {
  if (canonicalPath.endsWith("Id") && canonicalPath.length > 2) {
    const catalogDisplay = options.referenceDisplayValues?.[canonicalPath]?.trim();
    if (catalogDisplay !== undefined && catalogDisplay.length > 0) {
      return catalogDisplay;
    }

    const base = canonicalPath.slice(0, -2);
    const displayValue = coerceToDeliveryString(getCanonicalValue(payload, `${base}.name`));
    if (displayValue !== undefined) {
      return displayValue;
    }
  }

  return coerceToDeliveryString(getCanonicalValue(payload, canonicalPath), {
    kind: options.kind,
  });
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
  const definitionById = new Map(
    input.definitions.map((definition) => [definition.id, definition] as const),
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
    const value = resolveCanonicalDeliveryValue(input.payload, canonicalPath, {
      kind: definitionById.get(fieldId)?.kind,
      referenceDisplayValues: input.referenceDisplayValues,
    });
    if (value !== undefined) {
      values[fieldId] = value;
    }
  }

  return { fieldValues: values };
}
