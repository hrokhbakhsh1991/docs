import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";

import { canonicalZodPathToFormFieldPath } from "@/features/tours/wizard/denali/rules/denaliCanonicalPathLookup";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { ApiError } from "@/lib/api-client";

/** Field-level item from API `error.details.validationErrors`. */
export type ApiValidationFieldError = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

const API_ROOT_TO_DENALI_FORM: Readonly<Record<string, FieldPath<DenaliCreateTourWizardForm>>> = {
  title: "basicInfo.title",
  total_capacity: "basicInfo.capacityMax",
  capacity: "basicInfo.capacityMax",
  lifecycle_status: "basicInfo.publishStatus",
  description: "programNature.longDescription",
  chat_link: "basicInfo.socialMediaLink",
  communicationLink: "basicInfo.socialMediaLink",
  destinationId: "basicInfo.destinationId",
  meetingPoint: "basicInfo.meetingPoint",
  tourType: "basicInfo.tourType",
  transportModes: "transport.transportMode",
  "cost_context.totalCost": "pricingPayment.basePricePerPerson",
  "overview.title": "basicInfo.title",
  "pricing.basePrice": "pricingPayment.basePricePerPerson",
  "logistics.primaryTransportMode": "transport.transportMode",
  "itinerary.days": "programNature.itinerary",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseValidationFieldError(item: unknown): ApiValidationFieldError | null {
  if (!isRecord(item)) {
    return null;
  }
  const path = typeof item.path === "string" ? item.path.trim() : "";
  const message = typeof item.message === "string" ? item.message.trim() : "";
  if (!path || !message) {
    return null;
  }
  const code = typeof item.code === "string" && item.code.trim() ? item.code.trim() : "VALIDATION_FAILED";
  return { path, code, message };
}

/** Reads structured `validationErrors` from an API error envelope on {@link ApiError.data}. */
export function extractApiValidationErrors(error: ApiError): ApiValidationFieldError[] {
  const data = error.data;
  if (!isRecord(data)) {
    return [];
  }
  const envelope = data as { error?: { details?: { validationErrors?: unknown } } };
  const raw = envelope.error?.details?.validationErrors;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ApiValidationFieldError[] = [];
  for (const item of raw) {
    const parsed = parseValidationFieldError(item);
    if (parsed) {
      out.push(parsed);
    }
  }
  return out;
}

/**
 * Maps create/update tour API validation paths to Denali wizard RHF paths.
 * Paths that already match the form shape (e.g. `tripDetails.*`) pass through unchanged.
 */
export function mapApiValidationPathToDenaliFormPath(
  apiPath: string,
): FieldPath<DenaliCreateTourWizardForm> | undefined {
  const trimmed = apiPath.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = API_ROOT_TO_DENALI_FORM[trimmed];
  if (direct) {
    return direct;
  }

  if (
    trimmed.startsWith("basicInfo.") ||
    trimmed.startsWith("programNature.") ||
    trimmed.startsWith("transport.") ||
    trimmed.startsWith("pricingPayment.") ||
    trimmed.startsWith("participantRequirements.") ||
    trimmed.startsWith("policies.") ||
    trimmed.startsWith("photosData.") ||
    trimmed.startsWith("tripDetails.")
  ) {
    return trimmed as FieldPath<DenaliCreateTourWizardForm>;
  }

  if (trimmed.startsWith("cost_context.")) {
    if (trimmed === "cost_context.totalCost") {
      return "pricingPayment.basePricePerPerson";
    }
    return undefined;
  }

  const segments = trimmed.split(".").filter(Boolean);
  const canonicalRoot = segments[0];
  if (canonicalRoot && KNOWN_CANONICAL_VALIDATION_ROOTS.has(canonicalRoot)) {
    return canonicalZodPathToFormFieldPath(segments);
  }

  return undefined;
}

/** Canonical segment heads understood by {@link canonicalZodPathToFormFieldPath}. */
const KNOWN_CANONICAL_VALIDATION_ROOTS = new Set([
  "title",
  "category",
  "duration",
  "destinationId",
  "startDateTime",
  "endDateTime",
  "capacityMax",
  "capacityMin",
  "meetingPoint",
  "startPointLocationText",
  "gatheringPoint",
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
  "approximateReturnTime",
  "leaderUserIds",
  "requiresLocalGuide",
  "localGuideName",
  "requiresManualAdminApproval",
  "socialMediaLink",
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
]);

export type ApplyApiValidationErrorsOptions = {
  /** When omitted, {@link mapApiValidationPathToDenaliFormPath} is used. Return `undefined` to skip a row. */
  mapPath?: (apiPath: string) => FieldPath<DenaliCreateTourWizardForm> | undefined;
};

/**
 * Applies API field validation errors to a react-hook-form instance.
 * @returns Count of fields that received a server error.
 */
export function applyApiValidationErrorsToForm(
  setError: UseFormSetError<DenaliCreateTourWizardForm>,
  errors: readonly ApiValidationFieldError[],
  options?: ApplyApiValidationErrorsOptions,
): number {
  return applyApiValidationErrorsToFormAtPaths(setError, errors, {
    mapPath: options?.mapPath ?? mapApiValidationPathToDenaliFormPath,
  });
}

/**
 * Applies API `validationErrors` onto any react-hook-form instance.
 * @returns Count of fields that received a server error.
 */
export function applyApiValidationErrorsToFormAtPaths<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  errors: readonly ApiValidationFieldError[],
  options?: {
    mapPath?: (apiPath: string) => FieldPath<TFieldValues> | undefined;
  },
): number {
  const mapPath =
    options?.mapPath ??
    ((apiPath: string) => apiPath.trim() as FieldPath<TFieldValues> | undefined);
  let applied = 0;

  for (const item of errors) {
    const formPath = mapPath(item.path);
    if (!formPath) {
      continue;
    }
    setError(formPath, { type: "server", message: item.message });
    applied += 1;
  }

  return applied;
}

export type HandleValidationApiErrorOptions<TFieldValues extends FieldValues> = {
  mapPath?: (apiPath: string) => FieldPath<TFieldValues> | undefined;
  clearErrors?: (name?: "root") => void;
  onApplied?: (issues: readonly { path: string; message: string }[]) => void;
};

/** Maps `VALIDATION_FAILED` envelope errors onto a form; returns true when at least one field was set. */
export function handleValidationApiError<TFieldValues extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<TFieldValues>,
  options?: HandleValidationApiErrorOptions<TFieldValues>,
): boolean {
  if (error.code !== "VALIDATION_FAILED") {
    return false;
  }

  const validationErrors = extractApiValidationErrors(error);
  if (validationErrors.length === 0) {
    return false;
  }

  const mapPath =
    options?.mapPath ??
    ((apiPath: string) => apiPath.trim() as FieldPath<TFieldValues> | undefined);
  const appliedIssues: { path: string; message: string }[] = [];

  for (const item of validationErrors) {
    const formPath = mapPath(item.path);
    if (!formPath) {
      continue;
    }
    setError(formPath, { type: "server", message: item.message });
    appliedIssues.push({ path: String(formPath), message: item.message });
  }

  if (appliedIssues.length === 0) {
    return false;
  }

  options?.clearErrors?.("root");
  options?.onApplied?.(appliedIssues);
  return true;
}

export type DenaliWizardAppliedValidationIssue = {
  readonly path: string;
  readonly message: string;
};

export type HandleDenaliWizardValidationApiErrorOptions = ApplyApiValidationErrorsOptions & {
  clearErrors?: (name?: "root") => void;
  onApplied?: (issues: readonly DenaliWizardAppliedValidationIssue[]) => void;
};

/**
 * When `error.code === VALIDATION_FAILED`, maps `details.validationErrors` onto the Denali wizard form.
 * @returns `true` if at least one field error was applied.
 */
export function handleDenaliWizardValidationApiError(
  error: ApiError,
  setError: UseFormSetError<DenaliCreateTourWizardForm>,
  options?: HandleDenaliWizardValidationApiErrorOptions,
): boolean {
  if (error.code !== "VALIDATION_FAILED") {
    return false;
  }

  const validationErrors = extractApiValidationErrors(error);
  if (validationErrors.length === 0) {
    return false;
  }

  const resolvePath = options?.mapPath ?? mapApiValidationPathToDenaliFormPath;
  const appliedIssues: DenaliWizardAppliedValidationIssue[] = [];

  for (const item of validationErrors) {
    const formPath = resolvePath(item.path);
    if (!formPath) {
      continue;
    }
    setError(formPath, { type: "server", message: item.message });
    appliedIssues.push({ path: formPath, message: item.message });
  }

  if (appliedIssues.length === 0) {
    return false;
  }

  options?.clearErrors?.("root");
  options?.onApplied?.(appliedIssues);
  return true;
}
