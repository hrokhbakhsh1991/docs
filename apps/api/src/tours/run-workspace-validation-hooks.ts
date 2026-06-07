import type {
  CanonicalDocument,
  WorkspaceFieldRegistryEntry,
  WorkspacePlugin,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function isCapacityField(field: WorkspaceFieldRegistryEntry): boolean {
  return (
    field.kind === "number" &&
    (field.id.endsWith(".capacity") ||
      field.id === "capacity" ||
      field.tags?.includes("capacity") === true)
  );
}

function isTripDetailsField(field: WorkspaceFieldRegistryEntry): boolean {
  return (
    field.kind === "composite" &&
    (field.id.includes("tripDetails") || field.tags?.includes("tripDetails") === true)
  );
}

function isTransportModesField(field: WorkspaceFieldRegistryEntry): boolean {
  return field.kind === "enum" && field.id.toLowerCase().includes("transportmodes");
}

function extractCapacity(
  plugin: WorkspacePlugin,
  data: Record<string, unknown>
): number | undefined {
  for (const field of plugin.fieldRegistry.fields) {
    if (!isCapacityField(field)) {
      continue;
    }
    const value = readCanonicalPath(data, field.canonicalPath);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function extractTripDetails(
  plugin: WorkspacePlugin,
  data: Record<string, unknown>
): { tripDetails: unknown; transportModes: readonly string[] | null } | undefined {
  let tripDetails: unknown;
  let transportModes: readonly string[] | null = null;

  for (const field of plugin.fieldRegistry.fields) {
    if (isTripDetailsField(field)) {
      tripDetails = readCanonicalPath(data, field.canonicalPath);
    }
    if (isTransportModesField(field)) {
      const raw = readCanonicalPath(data, field.canonicalPath);
      if (typeof raw === "string" && raw.length > 0) {
        transportModes = [raw];
      } else if (Array.isArray(raw)) {
        transportModes = raw.filter((entry): entry is string => typeof entry === "string");
      }
    }
  }

  if (tripDetails === undefined) {
    return undefined;
  }
  return { tripDetails, transportModes };
}

/**
 * Phase 3 API — workspace plugin validation hooks after platform-core {@link validateCanonical}.
 * Registry-driven extraction (capacity / tripDetails / transportModes); Denali-specific rules live in workspace plugins (phase 6).
 */
export function runWorkspaceValidationHooks(
  plugin: WorkspacePlugin,
  document: CanonicalDocument
): WorkspaceViolation | null {
  const data = document.data as Record<string, unknown>;

  const capacity = extractCapacity(plugin, data);
  if (capacity !== undefined) {
    const violation = plugin.validation.checkCapacity(capacity);
    if (violation != null) {
      return violation;
    }
  }

  const trip =
    extractTripDetails(plugin, data) ??
    (Object.prototype.hasOwnProperty.call(data, "tripDetails")
      ? { tripDetails: data.tripDetails, transportModes: null }
      : undefined);
  if (trip !== undefined) {
    const violation = plugin.validation.checkTripDetails(trip.tripDetails, trip.transportModes);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}
