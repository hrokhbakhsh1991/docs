import type { FieldPath, UseFormSetError } from "react-hook-form";

import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "@repo/denali-domain";
import {
  listDenaliTemplateLegacyOverlayPaths,
  toDenaliTemplateStoragePath,
  validateDenaliCanonicalTemplateData,
} from "@repo/types/denali";

import { denaliCanonicalFromForm } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { DenaliWorkspaceTemplatePayload, UniversalValidationIssue } from "@/lib/validation/universal-validator";

export type TourWizardTemplateBuilderFormValues = {
  fieldRulesOverlay: Record<string, { visibility: string; required: string }>;
  canonicalData: Record<string, unknown>;
};

export type OverlayRowProp = "visibility" | "required";

const OVERLAY_ISSUE_PREFIX = "fieldRulesOverlay.";
const CANONICAL_ISSUE_PREFIX = "canonicalData.";

const STORAGE_PATH_TO_DEFINITION = new Map<string, DenaliFieldDefinition>();
for (const def of DENALI_FIELD_DEFINITIONS) {
  if (def.inRuleModel === false) {
    continue;
  }
  STORAGE_PATH_TO_DEFINITION.set(toDenaliTemplateStoragePath(def.canonicalPath), def);
}

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

export function canonicalSeedRegistrationPath(
  storagePath: string,
): FieldPath<TourWizardTemplateBuilderFormValues> {
  return `canonicalData[${storagePath}]` as FieldPath<TourWizardTemplateBuilderFormValues>;
}

export function getDenaliTemplateSeedFieldDefinition(
  storagePath: string,
): DenaliFieldDefinition | undefined {
  return STORAGE_PATH_TO_DEFINITION.get(storagePath);
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

function mapCanonicalValidationPathToFormPath(
  issuePath: string,
): FieldPath<TourWizardTemplateBuilderFormValues> | undefined {
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
  return canonicalSeedRegistrationPath(storagePath);
}

/** Maps API/client validation paths onto bracket-notation RHF overlay fields. */
export function mapOverlayValidationPathToFormPath(
  issuePath: string,
): FieldPath<TourWizardTemplateBuilderFormValues> | undefined {
  const canonicalPath = mapCanonicalValidationPathToFormPath(issuePath);
  if (canonicalPath) {
    return canonicalPath;
  }
  const parsed = parseOverlayValidationIssuePath(issuePath);
  if (!parsed) {
    return undefined;
  }
  return overlayRowRegistrationPath(parsed.storagePath, parsed.prop);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isEmptySeedValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

/** Read a dot path from nested canonical JSONB (Layer A storage vocabulary). */
export function readCanonicalNestedValue(
  canonical: Readonly<Record<string, unknown>>,
  storagePath: string,
): unknown {
  const segments = storagePath.split(".").filter(Boolean);
  let current: unknown = canonical;
  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/** Write a dot path into a nested object (mutates `target`). */
export function writeCanonicalNestedValue(
  target: Record<string, unknown>,
  storagePath: string,
  value: unknown,
): void {
  const segments = storagePath.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }
  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const next = current[segment];
    if (!isPlainObject(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1]!;
  if (isEmptySeedValue(value)) {
    delete current[leaf];
    return;
  }
  current[leaf] = value;
}

function pruneEmptyNestedObjects(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (isPlainObject(child)) {
      pruneEmptyNestedObjects(child);
      if (Object.keys(child).length === 0) {
        delete value[key];
      }
    }
  }
}

/** Flatten template JSONB into bracket-key RHF seed values for Layer C paths. */
export function unpackCanonicalTemplateToFormValues(
  canonical: Readonly<Record<string, unknown>>,
  seedPaths: readonly string[],
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const path of seedPaths) {
    const value = readCanonicalNestedValue(canonical, path);
    if (!isEmptySeedValue(value)) {
      flat[path] = value;
    }
  }
  return flat;
}

/**
 * Builds canonical JSONB for template save: preview wizard form is authoritative when
 * classified ({@link denaliCanonicalFromForm}); otherwise falls back to left-panel seeds.
 */
export function buildTemplateCanonicalDataForSave(
  previewForm: DenaliCreateTourWizardForm | null | undefined,
  leftPanelFlat: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const leftPacked = packCanonicalFormValuesToTemplateData(leftPanelFlat);
  const tourType = previewForm?.basicInfo?.tourType?.trim();
  if (!previewForm || !tourType) {
    return leftPacked;
  }
  try {
    const fromPreview = denaliCanonicalFromForm(previewForm) as Record<string, unknown>;
    return mergePreviewCanonicalWithLeftSeeds(fromPreview, leftPacked);
  } catch {
    return leftPacked;
  }
}

/** Left-panel scalar seeds fill gaps; preview wins on program (incl. itinerary) when both define a slice. */
function mergePreviewCanonicalWithLeftSeeds(
  fromPreview: Record<string, unknown>,
  leftPacked: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...fromPreview };
  if (merged.category === undefined && leftPacked.category !== undefined) {
    merged.category = leftPacked.category;
  }
  if (merged.duration === undefined && leftPacked.duration !== undefined) {
    merged.duration = leftPacked.duration;
  }
  if (typeof merged.title !== "string" || merged.title.trim() === "") {
    const leftTitle = leftPacked.title;
    if (typeof leftTitle === "string" && leftTitle.trim() !== "") {
      merged.title = leftTitle;
    }
  }

  const previewProgram = isPlainObject(merged.program) ? merged.program : {};
  const leftProgram = isPlainObject(leftPacked.program) ? leftPacked.program : {};
  if (Object.keys(previewProgram).length > 0 || Object.keys(leftProgram).length > 0) {
    const previewItinerary = previewProgram.itinerary;
    const leftItinerary = leftProgram.itinerary;
    merged.program = {
      ...leftProgram,
      ...previewProgram,
      itinerary:
        Array.isArray(previewItinerary) && previewItinerary.length > 0
          ? previewItinerary
          : leftItinerary,
    };
  }

  return merged;
}

/**
 * Packs template canonical JSONB for persist: preview form is source of truth when classified;
 * left-panel flat seeds supplement classification and pre-flattened paths.
 */
export function packTemplateCanonicalForPersist(
  previewForm: DenaliCreateTourWizardForm | null | undefined,
  leftPanelFlat: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return buildTemplateCanonicalDataForSave(previewForm, leftPanelFlat);
}

/** Dot-walk flat seed record back into nested canonical JSONB (Layer A shape). */
export function packCanonicalFormValuesToTemplateData(
  flat: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const packed: Record<string, unknown> = {};
  for (const [storagePath, value] of Object.entries(flat)) {
    if (isEmptySeedValue(value)) {
      continue;
    }
    writeCanonicalNestedValue(packed, storagePath, value);
  }
  pruneEmptyNestedObjects(packed);
  return packed;
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

  const canonical = (template?.canonicalData ?? {}) as Record<string, unknown>;
  const canonicalData = unpackCanonicalTemplateToFormValues(canonical, fieldPaths);

  return { fieldRulesOverlay, canonicalData };
}

export type BuildTourWizardTemplatePayloadOptions = {
  /**
   * Layer A canonical from {@link packTemplateCanonicalForPersist} — skip re-packing flat
   * `values.canonicalData` so preview merges (itinerary, duration, etc.) are not dropped.
   */
  canonicalLayerA?: Readonly<Record<string, unknown>>;
};

export function buildTourWizardTemplatePayloadFromForm(
  values: TourWizardTemplateBuilderFormValues,
  fieldPaths?: readonly string[],
  options?: BuildTourWizardTemplatePayloadOptions,
): DenaliWorkspaceTemplatePayload {
  const fieldRulesOverlay: Record<string, unknown> = {};

  const pathsToRead =
    fieldPaths ??
    Object.keys(values.fieldRulesOverlay).filter((path) => isOverlayRow(values.fieldRulesOverlay[path]));

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

  const canonicalData =
    options?.canonicalLayerA != null
      ? { ...options.canonicalLayerA }
      : packCanonicalFormValuesToTemplateData(values.canonicalData ?? {});

  return { fieldRulesOverlay, canonicalData };
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
): TenantWizardTemplate {
  const fieldRulesOverlay = buildTourWizardTemplatePayloadFromForm(
    { ...values, canonicalData: {} },
    fieldPaths,
  ).fieldRulesOverlay;

  return {
    ...baseTemplate,
    fieldRulesOverlay,
  };
}

export function applyUniversalValidationIssuesToForm(
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
