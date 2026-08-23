import type {
  WorkspaceFieldRegistryEntry,
  WorkspacePolicyValidator,
  WorkspaceValidationPipelineContext,
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

function runUrbanFlatValidationHooks(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const { plugin, document } = ctx;
  const data = document.data as Record<string, unknown>;

  for (const field of plugin.fieldRegistry.fields) {
    if (!isCapacityField(field)) {
      continue;
    }
    const value = readCanonicalPath(data, field.canonicalPath);
    if (typeof value === "number" && Number.isFinite(value)) {
      const violation = plugin.validation.checkCapacity(value);
      if (violation != null) {
        return violation;
      }
    }
  }

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

  const trip =
    tripDetails !== undefined
      ? { tripDetails, transportModes }
      : Object.prototype.hasOwnProperty.call(data, "tripDetails")
        ? { tripDetails: data.tripDetails, transportModes: null }
        : undefined;

  if (trip !== undefined) {
    const violation = plugin.validation.checkTripDetails(trip.tripDetails, trip.transportModes);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}

/** CW8-05 — Urban workspace policy module (flat hooks via manifest seam; no booking/Denali rules). */
export function createUrbanTourWorkspacePolicyValidator(): WorkspacePolicyValidator {
  return Object.freeze({
    supersedesFlatHooks: true,
    validate(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
      return runUrbanFlatValidationHooks(ctx);
    },
  });
}
