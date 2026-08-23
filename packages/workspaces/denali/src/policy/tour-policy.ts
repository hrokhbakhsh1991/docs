import type {
  WorkspaceFieldRegistryEntry,
  WorkspacePolicyValidator,
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { validateDenaliPublishReadinessSyncFromHostInput } from "../wizard/denali-wizard-validation";

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

function runDenaliFlatValidationHooks(
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

function runDenaliPublishReadiness(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const hostValidate = ctx.plugin.wizardHost?.validatePublishReadiness;
  if (hostValidate == null || ctx.rulesModule == null) {
    return null;
  }

  const result = validateDenaliPublishReadinessSyncFromHostInput({
    draft: { data: ctx.document.data as Record<string, unknown> },
    rulesModule: ctx.rulesModule,
    evalContext: {},
    scope: { publishTransition: true },
  });

  if (result.ok) {
    return null;
  }

  const first = result.violations[0];
  return {
    code: first?.code ?? "PUBLISH_READINESS_FAILED",
    message: first?.message ?? "publish readiness failed",
  };
}

/** CW8-04 — Denali workspace policy module (flat hooks + publish matrix via manifest seam). */
export function createDenaliTourWorkspacePolicyValidator(): WorkspacePolicyValidator {
  return Object.freeze({
    supersedesFlatHooks: true,
    validate(ctx: WorkspaceValidationPipelineContext): WorkspaceViolation | null {
      const hookViolation = runDenaliFlatValidationHooks(ctx);
      if (hookViolation != null) {
        return hookViolation;
      }

      if (ctx.validationMode === "publish") {
        return runDenaliPublishReadiness(ctx);
      }

      return null;
    },
  });
}
