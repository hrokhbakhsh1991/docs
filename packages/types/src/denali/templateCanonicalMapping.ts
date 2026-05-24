import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "./validateCanonicalTemplateData";
import type { DenaliCanonicalTemplateData } from "./denaliTemplateSchema";
import { DENALI_TEMPLATE_SCHEMA_VERSION } from "./denaliTemplateSchema";
import type {
  StoredWorkspaceTourTemplateRow,
  WorkspaceTourTemplateRecord,
} from "./workspaceTourTemplate";

export type { StoredWorkspaceTourTemplateRow, WorkspaceTourTemplateRecord } from "./workspaceTourTemplate";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Strips any key not declared on {@link DenaliCanonicalTourModel} (top-level).
 * Legacy `defaults`, `overview`, `fieldRulesOverlay`, etc. are discarded entirely.
 */
export function sanitizeDenaliCanonicalTemplateData(value: unknown): DenaliCanonicalTemplateData {
  if (!isPlainObject(value)) {
    return {};
  }
  const data: Record<string, unknown> = {};
  for (const key of DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS) {
    const nested = value[key];
    if (nested !== undefined) {
      data[key] = nested;
    }
  }
  return data as DenaliCanonicalTemplateData;
}

export function collectDiscardedTemplateKeys(value: unknown): string[] {
  if (!isPlainObject(value)) {
    return [];
  }
  const allowed = new Set<string>(DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS);
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/**
 * Extracts the wizard-canonical payload from a stored template row.
 * Does **not** read legacy `defaults`, `fieldRulesOverlay`, or `stepOverrides`.
 */
export function templateToCanonical(
  template: StoredWorkspaceTourTemplateRow | null | undefined,
): DenaliCanonicalTemplateData {
  if (template == null) {
    return {};
  }
  return sanitizeDenaliCanonicalTemplateData(template.canonicalData);
}

/**
 * Builds a canonical-only template record for persistence / wizard session interchange.
 */
export function canonicalToTemplate(
  canonical: DenaliCanonicalTemplateData,
  meta: Omit<WorkspaceTourTemplateRecord, "canonicalData" | "schemaVersion">,
): WorkspaceTourTemplateRecord {
  return {
    ...meta,
    schemaVersion: DENALI_TEMPLATE_SCHEMA_VERSION,
    canonicalData: sanitizeDenaliCanonicalTemplateData(canonical),
  };
}

/** True when stored row still carries legacy keys outside the canonical model. */
export function storedTemplateRowIsLegacy(template: StoredWorkspaceTourTemplateRow): boolean {
  const discardedFromCanonical = collectDiscardedTemplateKeys(template.canonicalData);
  const hasLegacyDefaults =
    isPlainObject(template.defaults) && Object.keys(template.defaults).length > 0;
  const hasLegacyOverlay =
    isPlainObject(template.fieldRulesOverlay) &&
    Object.keys(template.fieldRulesOverlay).length > 0;
  const hasLegacySteps =
    isPlainObject(template.stepOverrides) &&
    (Array.isArray((template.stepOverrides as { skip?: unknown }).skip) &&
      ((template.stepOverrides as { skip: unknown[] }).skip.length > 0) ||
      (Array.isArray((template.stepOverrides as { insert?: unknown }).insert) &&
        ((template.stepOverrides as { insert: unknown[] }).insert.length > 0)));
  return (
    discardedFromCanonical.length > 0 ||
    hasLegacyDefaults ||
    hasLegacyOverlay ||
    hasLegacySteps
  );
}

export type CleanupLegacyTemplatesReport = {
  presetsDeleted: number;
  wizardTemplatesReset: number;
  obsoletePresetRows: number;
  obsoleteWizardTemplateRows: number;
};
