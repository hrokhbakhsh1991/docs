/**
 * Submit projection authority for the Denali workspace wizard.
 * Business rules live in `@repo/denali-domain` — this module wires prune + submit mode + DTO shape.
 */
import { DENALI_ROOTS } from "@repo/shared-contracts";
import {
  buildDenaliCreateTourPayloadProjection,
  pruneDenaliWizardFormToRegistry,
  type DenaliCreateTourPayloadProjection,
} from "@repo/denali-domain";

import { LoggerService } from "@/lib/logging/logger.service";
import type { CreateTourDto } from "@/lib/services/tours.service";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  DenaliProductionErrorCode,
  FatalProjectionError,
} from "@/features/tours/wizard/errors/denali-production-errors";

export { FatalProjectionError } from "@/features/tours/wizard/errors/denali-production-errors";

export {
  buildDenaliCreateTourPayloadProjection,
  buildDenaliStagingShellProjection,
  buildDenaliSubmitItinerarySlice,
  denaliDayPlansToSegmentActivities,
  denaliTourKindToApiTourType,
  pruneDenaliWizardFormToRegistry,
  splitIsoDateTime,
  type BuildDenaliCreateTourPayloadProjectionOptions,
  type DenaliCreateTourPayloadProjection,
  type DenaliCreateTourPayloadProjectionMode,
} from "@repo/denali-domain";

const DENALI_ROOT_SET = new Set<string>(DENALI_ROOTS);

/** Top-level keys allowed on submit-grade {@link DenaliCreateTourPayloadProjection} before DTO mapping. */
const DENALI_SUBMIT_PROJECTION_KEY_SET = new Set<string>([
  "autoAcceptRegistrations",
  "capacity",
  "communicationLink",
  "customServiceLabels",
  "description",
  "destinationId",
  "durationDays",
  "lifecycle_status",
  "meetingPoint",
  "paymentMode",
  "price",
  "requiresPayment",
  "title",
  "tourType",
  "transportModes",
  "tripDetails",
]);

export type DenaliSubmitProjectionContext = {
  workspaceId?: string | null;
};

function collectNonRegistryRootKeys(form: DenaliCreateTourWizardForm): string[] {
  const record = form as unknown as Record<string, unknown>;
  return Object.keys(record).filter((key) => !DENALI_ROOT_SET.has(key));
}

function logFatalProjection(message: string, context: DenaliSubmitProjectionContext, meta: Record<string, unknown>): void {
  LoggerService.error(message, {
    workspaceId: context.workspaceId ?? undefined,
    layer: "denali_submit_projection",
    ...meta,
  });
}

function assertDenaliWizardFormRegistryStrict(
  form: DenaliCreateTourWizardForm,
  context: DenaliSubmitProjectionContext,
): void {
  const offendingKeys = collectNonRegistryRootKeys(form);
  if (offendingKeys.length === 0) {
    return;
  }

  const message = `[${DenaliProductionErrorCode.FATAL_PROJECTION_REGISTRY_ROOT}] Wizard form contains non-registry root keys before submit prune: ${offendingKeys.join(", ")}`;
  logFatalProjection(message, context, {
    code: DenaliProductionErrorCode.FATAL_PROJECTION_REGISTRY_ROOT,
    offendingKeys,
  });
  throw new FatalProjectionError(
    DenaliProductionErrorCode.FATAL_PROJECTION_REGISTRY_ROOT,
    message,
    offendingKeys,
  );
}

function assertSubmitProjectionRegistry(
  projection: DenaliCreateTourPayloadProjection,
  context: DenaliSubmitProjectionContext,
): void {
  const offendingKeys = Object.keys(projection).filter(
    (key) => !DENALI_SUBMIT_PROJECTION_KEY_SET.has(key),
  );
  if (offendingKeys.length === 0) {
    return;
  }

  const message = `[${DenaliProductionErrorCode.FATAL_PROJECTION_SUBMIT_KEYS}] Submit projection contains keys outside the submit projection registry: ${offendingKeys.join(", ")}`;
  logFatalProjection(message, context, {
    code: DenaliProductionErrorCode.FATAL_PROJECTION_SUBMIT_KEYS,
    offendingKeys,
    projection,
  });
  throw new FatalProjectionError(
    DenaliProductionErrorCode.FATAL_PROJECTION_SUBMIT_KEYS,
    message,
    offendingKeys,
  );
}

/**
 * Mandatory submit prune — strips registry-invalid roots/paths before projection.
 * Throws {@link FatalProjectionError} when smuggled keys are present (all environments).
 */
export function pruneDenaliWizardFormForSubmit(
  form: DenaliCreateTourWizardForm,
  context: DenaliSubmitProjectionContext = {},
): DenaliCreateTourWizardForm {
  assertDenaliWizardFormRegistryStrict(form, context);
  return pruneDenaliWizardFormToRegistry(form);
}

/**
 * Submit-grade projection from a registry-pruned form — explicit `mode: "submit"` (never staging).
 * Input must already be pruned (e.g. via {@link prepareDenaliSubmitArtifact} in submit-orchestrator).
 */
export function buildDenaliSubmitPayloadProjection(
  prunedForm: DenaliCreateTourWizardForm,
  context: DenaliSubmitProjectionContext = {},
): DenaliCreateTourPayloadProjection {
  try {
    const projection = buildDenaliCreateTourPayloadProjection(prunedForm, { mode: "submit" });
    assertSubmitProjectionRegistry(projection, context);
    return projection;
  } catch (error) {
    if (error instanceof FatalProjectionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = `[${DenaliProductionErrorCode.FATAL_PROJECTION_BUILD_FAILED}] buildDenaliCreateTourPayloadProjection failed: ${message}`;
    logFatalProjection(wrapped, context, {
      code: DenaliProductionErrorCode.FATAL_PROJECTION_BUILD_FAILED,
      cause: message,
    });
    throw new FatalProjectionError(DenaliProductionErrorCode.FATAL_PROJECTION_BUILD_FAILED, wrapped);
  }
}

/**
 * Registry-strict submit projection: prune smuggled matrix state, then project with explicit submit mode.
 */
export function projectDenaliWizardFormForSubmit(
  form: DenaliCreateTourWizardForm,
  context: DenaliSubmitProjectionContext = {},
): DenaliCreateTourPayloadProjection {
  return buildDenaliSubmitPayloadProjection(pruneDenaliWizardFormForSubmit(form, context), context);
}

/** 1:1 copy from resolved projection → {@link CreateTourDto} (no business rules). */
export function mapDenaliCreateTourPayloadProjectionToDto(
  projection: DenaliCreateTourPayloadProjection,
): CreateTourDto {
  return {
    title: projection.title,
    description: projection.description,
    tourType: projection.tourType,
    destinationId: projection.destinationId,
    capacity: projection.capacity,
    price: projection.price,
    autoAcceptRegistrations: projection.autoAcceptRegistrations,
    lifecycle_status: projection.lifecycle_status,
    tripDetails: projection.tripDetails,
    durationDays: projection.durationDays,
    requiresPayment: projection.requiresPayment,
    paymentMode: projection.paymentMode,
    meetingPoint: projection.meetingPoint,
    communicationLink: projection.communicationLink,
    transportModes: projection.transportModes,
    ...(projection.customServiceLabels && projection.customServiceLabels.length > 0
      ? { customServiceLabels: [...projection.customServiceLabels] }
      : {}),
  };
}

/** Canonical wizard submit → {@link CreateTourDto} via prune + submit projection + DTO mapper. */
export function mapDenaliWizardFormToSubmitDto(
  form: DenaliCreateTourWizardForm,
  context: DenaliSubmitProjectionContext = {},
): CreateTourDto {
  return mapDenaliCreateTourPayloadProjectionToDto(projectDenaliWizardFormForSubmit(form, context));
}
