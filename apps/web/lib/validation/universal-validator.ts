import { validateDenaliCanonicalTemplateData } from "@repo/types/denali";

import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import { denaliRuleSet, listDenaliRuleFieldPaths } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { mapTemplateToRuleModel } from "@/features/tours/wizard/domain/ruleModelConverter";
import { getDenaliWizardSubmitIssues } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

export type UniversalValidationIssue = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

export type DenaliWorkspaceTemplatePayload = {
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly canonicalData: unknown;
};

export type UniversalValidatorOptions = {
  /** `publish` runs submit-gate validation on hydrated canonical defaults. */
  readonly mode?: "save" | "publish";
  readonly ruleSet?: DenaliRuleSet;
};

const VISIBILITY = new Set(["always", "active", "hidden"]);
const REQUIREDNESS = new Set(["required", "recommended", "optional", "forbidden"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function validateOverlayPatches(
  overlay: Readonly<Record<string, unknown>>,
  allowedPaths: ReadonlySet<string>,
): UniversalValidationIssue[] {
  const issues: UniversalValidationIssue[] = [];

  if (!isPlainObject(overlay)) {
    return [
      {
        path: "fieldRulesOverlay",
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "fieldRulesOverlay must be a JSON object",
      },
    ];
  }

  for (const [path, raw] of Object.entries(overlay)) {
    const fieldPath = `fieldRulesOverlay.${path}`;
    if (!path.trim()) {
      issues.push({
        path: fieldPath,
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "Overlay field path cannot be empty",
      });
      continue;
    }
    if (!allowedPaths.has(path)) {
      issues.push({
        path: fieldPath,
        code: "VALIDATION_UNKNOWN_FIELD",
        message: `Unknown Denali rule field path "${path}"`,
      });
      continue;
    }
    if (!isPlainObject(raw)) {
      issues.push({
        path: fieldPath,
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "Overlay entry must be an object",
      });
      continue;
    }
    const visibility = raw.visibility;
    const required = raw.required;
    if (
      visibility !== undefined &&
      (typeof visibility !== "string" || !VISIBILITY.has(visibility))
    ) {
      issues.push({
        path: `${fieldPath}.visibility`,
        code: "VALIDATION_ENUM_INVALID",
        message: "visibility must be always, active, or hidden",
      });
    }
    if (
      required !== undefined &&
      (typeof required !== "string" || !REQUIREDNESS.has(required))
    ) {
      issues.push({
        path: `${fieldPath}.required`,
        code: "VALIDATION_ENUM_INVALID",
        message: "required must be required, recommended, optional, or forbidden",
      });
    }
    if (visibility === undefined && required === undefined) {
      issues.push({
        path: fieldPath,
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "Overlay entry must set visibility and/or required",
      });
    }
  }

  return issues;
}

function validatePublishGate(
  canonicalData: unknown,
  ruleSet: DenaliRuleSet,
): UniversalValidationIssue[] {
  const hydrated = tryHydrateCanonicalTemplate(
    isPlainObject(canonicalData) ? canonicalData : {},
    buildDenaliTourCreateDefaultValues(),
  );
  if (hydrated == null) {
    return [];
  }

  const normalized = normalizeDenaliWizardForm(hydrated.formValues, undefined, ruleSet);
  const submitIssues = getDenaliWizardSubmitIssues(normalized, undefined, ruleSet);
  return submitIssues.map((issue) => ({
    path: issue.path?.join(".") ?? "canonicalData",
    code: "VALIDATION_REQUIRED_FIELD_MISSING",
    message: issue.message,
  }));
}

/**
 * Validates workspace tour wizard template payloads against the Denali rule set
 * (overlay paths/enums, canonical JSONB shape, optional publish submit gate).
 */
export function validateDenaliWorkspaceTemplate(
  payload: DenaliWorkspaceTemplatePayload,
  options?: UniversalValidatorOptions,
): UniversalValidationIssue[] {
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  const allowedPaths = new Set(listDenaliRuleFieldPaths(ruleSet));
  const issues: UniversalValidationIssue[] = [];

  issues.push(...validateOverlayPatches(payload.fieldRulesOverlay, allowedPaths));

  const canonicalResult = validateDenaliCanonicalTemplateData(payload.canonicalData);
  if (!canonicalResult.ok) {
    for (const row of canonicalResult.issues) {
      issues.push({
        path: row.path === "<root>" ? "canonicalData" : `canonicalData.${row.path}`,
        code: "VALIDATION_UNKNOWN_FIELD",
        message: row.message,
      });
    }
  }

  if (options?.mode === "publish" && issues.length === 0) {
    issues.push(...validatePublishGate(payload.canonicalData, ruleSet));
  }

  return issues;
}

/** Validates a persisted tenant template row (overlay + canonical) using {@link mapTemplateToRuleModel}. */
export function validateTenantWizardTemplate(
  template: {
    readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
    readonly canonicalData: unknown;
  } | null | undefined,
  options?: UniversalValidatorOptions,
): UniversalValidationIssue[] {
  const ruleSet = options?.ruleSet ?? mapTemplateToRuleModel(template ?? null).ruleSet;
  return validateDenaliWorkspaceTemplate(
    {
      fieldRulesOverlay: template?.fieldRulesOverlay ?? {},
      canonicalData: template?.canonicalData ?? {},
    },
    { ...options, ruleSet },
  );
}
