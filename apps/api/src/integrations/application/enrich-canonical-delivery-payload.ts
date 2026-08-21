import { getCanonicalValue, type FieldDefinition, type FieldPolicyEntityState } from "@app-tour/platform-core";
import type { WorkspaceCanonicalDeliveryProjectionInput } from "@app-tour/workspace-sdk";

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
  readonly projectCanonicalDeliveryFields?: (
    input: WorkspaceCanonicalDeliveryProjectionInput
  ) => Readonly<Record<string, string>>;
};

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})/;
const DELIVERY_DATE_TIME_LOCALE = "fa-IR";
const DELIVERY_DATE_TIME_TIME_ZONE = "Asia/Tehran";

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

  const projected = input.projectCanonicalDeliveryFields?.({
    payload: input.payload,
    eligibleFieldIds: input.eligibleFieldIds,
    definitions: input.definitions,
    referenceDisplayValues: input.referenceDisplayValues,
  });
  if (projected !== undefined) {
    Object.assign(values, projected);
  }

  return { fieldValues: values };
}
