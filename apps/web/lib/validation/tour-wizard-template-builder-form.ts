import type { FieldPath, UseFormSetError } from "react-hook-form";

import {
  DENALI_FIELD_DEFINITIONS,
  listDenaliTemplateStorageFieldPaths,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "@repo/denali-domain";
import {
  listDenaliTemplateLegacyOverlayPaths,
  toDenaliTemplateStoragePath,
  validateDenaliCanonicalTemplateData,
  denaliCanonicalFromForm,
  DenaliCanonicalTourTypeRequiredError,
  type DenaliCanonicalFromFormCarryForward,
  type DenaliCanonicalTemplateData,
} from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { DenaliWorkspaceTemplatePayload, UniversalValidationIssue } from "@/lib/validation/universal-validator";

export type TourWizardTemplateBuilderFormValues = {
  fieldRulesOverlay: Record<string, { visibility: string; required: string }>;
};

export type OverlayRowProp = "visibility" | "required";

const OVERLAY_ISSUE_PREFIX = "fieldRulesOverlay.";
const CANONICAL_ISSUE_PREFIX = "canonicalData.";

const TEMPLATE_STORAGE_PATHS = new Set(listDenaliTemplateStorageFieldPaths());

const STORAGE_PATH_TO_DEFINITION = new Map<string, DenaliFieldDefinition>();
for (const def of DENALI_FIELD_DEFINITIONS) {
  const storagePath = toDenaliTemplateStoragePath(def.canonicalPath);
  if (!TEMPLATE_STORAGE_PATHS.has(storagePath)) {
    continue;
  }
  STORAGE_PATH_TO_DEFINITION.set(storagePath, def);
}

/** Numeric seeds that display with thousands separators in the template builder. */
export const DENALI_TEMPLATE_SEED_THOUSANDS_FORMAT_PATHS = new Set<string>([
  "overview.peakHeight",
  "transport.transportCost",
  "transport.dongAmount",
  "pricing.basePricePerPerson",
]);

/** Composite registry kinds edited in preview — no scalar seed widget on the left panel. */
export const DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS = new Set<DenaliZodFieldKind>([
  "itinerary",
  "locationData",
  "gatheringPoints",
  "gearItems",
  "photos",
]);

export const DENALI_TEMPLATE_SEED_NUMERIC_ZOD_KINDS = new Set<DenaliZodFieldKind>([
  "optionalInt",
  "optionalPositiveInt",
  "capacityMax",
  "difficultyLevel",
  "fitnessLevel",
  "minRequiredPeaks",
]);

/** RHF field name with bracket notation so dotted storage paths stay flat object keys. */
export function overlayRowRegistrationPath(
  storagePath: string,
  prop: OverlayRowProp,
): FieldPath<TourWizardTemplateBuilderFormValues> {
  return `fieldRulesOverlay[${storagePath}].${prop}` as FieldPath<TourWizardTemplateBuilderFormValues>;
}

export function getDenaliTemplateSeedFieldDefinition(
  storagePath: string,
): DenaliFieldDefinition | undefined {
  return STORAGE_PATH_TO_DEFINITION.get(storagePath);
}

/** Wizard RHF path for a template storage seed (registry authority). */
export function templateSeedRhfPath(
  storagePath: string,
): FieldPath<DenaliCreateTourWizardForm> | undefined {
  const definition = getDenaliTemplateSeedFieldDefinition(storagePath);
  return definition?.rhfPath as FieldPath<DenaliCreateTourWizardForm> | undefined;
}

type ParsedOverlayIssuePath = {
  readonly storagePath: string;
  readonly prop: OverlayRowProp;
};

/** Parses validator/API paths like `fieldRulesOverlay.overview.peakHeight.visibility`. */
export function parseOverlayValidationIssuePath(issuePath: string): ParsedOverlayIssuePath | null {
  const trimmed = issuePath.trim();
  if (!trimmed.startsWith(OVERLAY_ISSUE_PREFIX)) {
    return null;
  }
  const suffix = trimmed.slice(OVERLAY_ISSUE_PREFIX.length);
  if (!suffix) {
    return null;
  }
  for (const prop of ["visibility", "required"] as const) {
    const marker = `.${prop}`;
    if (suffix.endsWith(marker)) {
      const storagePath = suffix.slice(0, -marker.length);
      if (storagePath) {
        return { storagePath, prop };
      }
    }
  }
  return { storagePath: suffix, prop: "visibility" };
}

function mapCanonicalValidationPathToWizardPath(
  issuePath: string,
): FieldPath<DenaliCreateTourWizardForm> | undefined {
  const trimmed = issuePath.trim();
  if (trimmed === "canonicalData") {
    return undefined;
  }
  if (!trimmed.startsWith(CANONICAL_ISSUE_PREFIX)) {
    return undefined;
  }
  const storagePath = trimmed.slice(CANONICAL_ISSUE_PREFIX.length);
  if (!storagePath) {
    return undefined;
  }
  return templateSeedRhfPath(storagePath);
}

/** Maps API/client validation paths onto bracket-notation RHF overlay fields. */
export function mapOverlayValidationPathToFormPath(
  issuePath: string,
): FieldPath<TourWizardTemplateBuilderFormValues> | undefined {
  const parsed = parseOverlayValidationIssuePath(issuePath);
  if (!parsed) {
    return undefined;
  }
  return overlayRowRegistrationPath(parsed.storagePath, parsed.prop);
}

function isOverlayRow(value: unknown): value is { visibility: string; required: string } {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.visibility === "string" && typeof row.required === "string";
}

function readOverlayPatch(
  overlay: Readonly<Record<string, unknown>>,
  path: string,
): { visibility: string; required: string } {
  const raw = overlay[path];
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { visibility: "", required: "" };
  }
  const row = raw as Record<string, unknown>;
  return {
    visibility: typeof row.visibility === "string" ? row.visibility : "",
    required: typeof row.required === "string" ? row.required : "",
  };
}

function readOverlayPatchForStoragePath(
  overlay: Readonly<Record<string, unknown>>,
  storagePath: string,
): { visibility: string; required: string } {
  const direct = readOverlayPatch(overlay, storagePath);
  if (direct.visibility || direct.required) {
    return direct;
  }
  for (const legacyPath of listDenaliTemplateLegacyOverlayPaths(storagePath)) {
    const legacy = readOverlayPatch(overlay, legacyPath);
    if (legacy.visibility || legacy.required) {
      return legacy;
    }
  }
  return { visibility: "", required: "" };
}

export function buildTourWizardTemplateBuilderDefaults(
  template: TenantWizardTemplate | null,
  fieldPaths: readonly string[],
): TourWizardTemplateBuilderFormValues {
  const overlay = template?.fieldRulesOverlay ?? {};
  const fieldRulesOverlay: Record<string, { visibility: string; required: string }> = {};
  for (const path of fieldPaths) {
    fieldRulesOverlay[path] = readOverlayPatchForStoragePath(overlay, path);
  }

  return { fieldRulesOverlay };
}

export type BuildTourWizardTemplatePayloadOptions = {
  canonicalData: DenaliCanonicalTemplateData;
};

export function buildTourWizardTemplatePayloadFromForm(
  values: TourWizardTemplateBuilderFormValues,
  fieldPaths: readonly string[],
  options: BuildTourWizardTemplatePayloadOptions,
): DenaliWorkspaceTemplatePayload {
  const fieldRulesOverlay: Record<string, unknown> = {};

  const pathsToRead =
    fieldPaths.length > 0
      ? fieldPaths
      : Object.keys(values.fieldRulesOverlay).filter((path) => isOverlayRow(values.fieldRulesOverlay[path]));

  for (const path of pathsToRead) {
    const row = values.fieldRulesOverlay[path];
    if (!isOverlayRow(row)) {
      continue;
    }
    const entry: Record<string, string> = {};
    const visibility = row.visibility.trim();
    const required = row.required.trim();
    if (visibility) {
      entry.visibility = visibility;
    }
    if (required) {
      entry.required = required;
    }
    if (Object.keys(entry).length > 0) {
      fieldRulesOverlay[path] = entry;
    }
  }

  return {
    fieldRulesOverlay,
    canonicalData: options.canonicalData as Record<string, unknown>,
  };
}

export type CanonicalDataFromWizardFormOptions = {
  /** Retain hidden canonical slices cleared from RHF before export (settings template save). */
  carryForward?: DenaliCanonicalFromFormCarryForward;
};

export function buildCanonicalCarryForwardFromTemplate(
  template: TenantWizardTemplate | null,
): DenaliCanonicalFromFormCarryForward | undefined {
  const canonical = template?.canonicalData;
  if (canonical == null || typeof canonical !== "object") {
    return undefined;
  }
  const record = canonical as DenaliCanonicalTemplateData;
  const programItinerary = record.program?.itinerary;
  const photos = record.photos;
  if (
    (programItinerary == null || programItinerary.length === 0) &&
    (photos == null || photos.length === 0)
  ) {
    return undefined;
  }
  return {
    ...(photos != null && photos.length > 0 ? { photos } : {}),
    ...(programItinerary != null && programItinerary.length > 0
      ? { programItinerary }
      : {}),
  };
}

/** Layer A canonical from hydrated wizard form (single write adapter). */
export function canonicalDataFromWizardForm(
  wizardForm: DenaliCreateTourWizardForm,
  options?: CanonicalDataFromWizardFormOptions,
): DenaliCanonicalTemplateData {
  return denaliCanonicalFromForm(wizardForm, options?.carryForward);
}

export function isWizardFormCanonicalExportError(
  error: unknown,
): error is DenaliCanonicalTourTypeRequiredError {
  return error instanceof DenaliCanonicalTourTypeRequiredError;
}

/** Validates packed canonical seed against Layer A schema; throws on failure. */
export function assertPackedCanonicalTemplateData(
  canonicalData: unknown,
): Record<string, unknown> {
  const result = validateDenaliCanonicalTemplateData(canonicalData);
  if (!result.ok) {
    const detail = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(detail || "INVALID_CANONICAL_TEMPLATE_DATA");
  }
  return result.data as Record<string, unknown>;
}

/** Live preview template — overlay reflects unsaved form edits; inherit rows omit overrides. */
export function buildPreviewWizardTemplate(
  baseTemplate: TenantWizardTemplate,
  values: Pick<TourWizardTemplateBuilderFormValues, "fieldRulesOverlay">,
  fieldPaths: readonly string[],
  canonicalData: Readonly<Record<string, unknown>>,
): TenantWizardTemplate {
  const fieldRulesOverlay = buildTourWizardTemplatePayloadFromForm(
    values,
    fieldPaths,
    { canonicalData: canonicalData as DenaliCanonicalTemplateData },
  ).fieldRulesOverlay;

  return {
    ...baseTemplate,
    fieldRulesOverlay,
    canonicalData: { ...canonicalData },
  };
}

export function applyUniversalValidationIssuesToOverlayForm(
  setError: UseFormSetError<TourWizardTemplateBuilderFormValues>,
  issues: readonly UniversalValidationIssue[],
): void {
  for (const issue of issues) {
    const formPath = mapOverlayValidationPathToFormPath(issue.path);
    if (!formPath) {
      continue;
    }
    setError(formPath, { type: "manual", message: issue.message });
  }
}

export function applyUniversalValidationIssuesToWizardForm(
  setError: UseFormSetError<DenaliCreateTourWizardForm>,
  issues: readonly UniversalValidationIssue[],
): void {
  for (const issue of issues) {
    const formPath = mapCanonicalValidationPathToWizardPath(issue.path);
    if (!formPath) {
      continue;
    }
    setError(formPath, { type: "manual", message: issue.message });
  }
}
