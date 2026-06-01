import type { TourFormProfile } from "@repo/types";
import {
  buildDenaliTourCreateDefaultValues,
  DENALI_FIELD_DEFINITIONS,
  getDenaliWizardSubmitIssues,
  listDenaliSettingsOverlayStoragePaths,
  resolveDenaliRuleSetFromOverlay,
  tryHydrateCanonicalTemplate,
} from "@repo/denali-domain";
import {
  formatDenaliTemplatePathSuggestion,
  toDenaliTemplateStoragePath,
  validateDenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateValidationIssue,
} from "@repo/types/denali";

import { throwValidationFailed } from "../../common/errors/throw-validation-failed";
import type { ValidationFieldError } from "../../common/errors/validation-errors.mapper";

const VISIBILITY = new Set(["always", "active", "hidden"]);
const REQUIREDNESS = new Set(["required", "recommended", "optional", "forbidden"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function validateOverlayRecord(
  overlay: Record<string, unknown> | undefined,
): ValidationFieldError[] {
  const out: ValidationFieldError[] = [];
  if (overlay == null) {
    return out;
  }
  if (!isPlainObject(overlay)) {
    return [
      {
        path: "fieldRulesOverlay",
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "fieldRulesOverlay must be a JSON object",
      },
    ];
  }

  const allowedPaths = new Set(listDenaliSettingsOverlayStoragePaths());

  for (const [path, raw] of Object.entries(overlay)) {
    const fieldPath = `fieldRulesOverlay.${path}`;
    if (!path.trim()) {
      out.push({
        path: fieldPath,
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "Overlay field path cannot be empty",
      });
      continue;
    }
    if (!allowedPaths.has(path)) {
      const storagePath = toDenaliTemplateStoragePath(path);
      const message =
        storagePath !== path && allowedPaths.has(storagePath)
          ? `Invalid overlay path "${path}" — use canonical path "${storagePath}" instead.`
          : formatDenaliTemplatePathSuggestion(path);
      out.push({
        path: fieldPath,
        code: "VALIDATION_UNKNOWN_FIELD",
        message,
      });
      continue;
    }
    if (!isPlainObject(raw)) {
      out.push({
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
      out.push({
        path: `${fieldPath}.visibility`,
        code: "VALIDATION_ENUM_INVALID",
        message: "visibility must be always, active, or hidden",
      });
    }
    if (
      required !== undefined &&
      (typeof required !== "string" || !REQUIREDNESS.has(required))
    ) {
      out.push({
        path: `${fieldPath}.required`,
        code: "VALIDATION_ENUM_INVALID",
        message: "required must be required, recommended, optional, or forbidden",
      });
    }
    if (visibility === undefined && required === undefined) {
      out.push({
        path: fieldPath,
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "Overlay entry must set visibility and/or required",
      });
    }
  }

  return out;
}

function mapCanonicalIssues(
  issues: readonly DenaliCanonicalTemplateValidationIssue[],
): ValidationFieldError[] {
  return issues.map((issue) => ({
    path: issue.path === "<root>" ? "canonicalData" : `canonicalData.${issue.path}`,
    code: "VALIDATION_UNKNOWN_FIELD",
    message: issue.message,
  }));
}

export type ValidateWorkspaceWizardTemplateInput = {
  fieldRulesOverlay?: Record<string, unknown>;
  canonicalData?: unknown;
};

export type WorkspaceWizardTemplateValidationOutcome = {
  errors: ValidationFieldError[];
  sanitizedCanonical?: DenaliCanonicalTemplateData;
};

/** Server-side template payload validation (canonical + overlay enums). */
export function validateWorkspaceWizardTemplatePayload(
  input: ValidateWorkspaceWizardTemplateInput,
): WorkspaceWizardTemplateValidationOutcome {
  const errors: ValidationFieldError[] = [];
  let sanitizedCanonical: DenaliCanonicalTemplateData | undefined;

  if (input.fieldRulesOverlay !== undefined) {
    errors.push(...validateOverlayRecord(input.fieldRulesOverlay));
  }

  if (input.canonicalData !== undefined) {
    const canonicalResult = validateDenaliCanonicalTemplateData(input.canonicalData);
    if (!canonicalResult.ok) {
      errors.push(...mapCanonicalIssues(canonicalResult.issues));
    } else {
      sanitizedCanonical = canonicalResult.data;
    }
  }

  return { errors, sanitizedCanonical };
}

/** Server-side template payload validation (canonical + overlay enums). */
export function collectWorkspaceWizardTemplateValidationErrors(
  input: ValidateWorkspaceWizardTemplateInput,
): ValidationFieldError[] {
  return validateWorkspaceWizardTemplatePayload(input).errors;
}

function mapSubmitIssuesToPublishErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ValidationFieldError[] {
  return issues.map((issue) => {
    const dotPath = issue.path.map(String).join(".");
    return {
      path: dotPath.length > 0 ? `canonicalData.${dotPath}` : "canonicalData",
      code: "VALIDATION_REQUIRED_FIELD_MISSING",
      message: issue.message,
    };
  });
}

/** Classification seed stored in canonical JSON but excluded from the rule-model matrix. */
const PUBLISH_ALLOWED_IN_RULE_MODEL_FALSE_PATHS = new Set(["duration"]);

function readValueAtStoragePath(
  canonical: DenaliCanonicalTemplateData,
  storagePath: string,
): unknown {
  const segments = storagePath.split(".");
  let current: unknown = canonical;
  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function collectDeprecatedFieldsInPublish(
  sanitizedCanonical: DenaliCanonicalTemplateData,
): ValidationFieldError[] {
  const errors: ValidationFieldError[] = [];

  for (const def of DENALI_FIELD_DEFINITIONS) {
    if (def.inRuleModel !== false) {
      continue;
    }
    const storagePath = toDenaliTemplateStoragePath(def.canonicalPath);
    if (PUBLISH_ALLOWED_IN_RULE_MODEL_FALSE_PATHS.has(storagePath)) {
      continue;
    }
    if (readValueAtStoragePath(sanitizedCanonical, storagePath) === undefined) {
      continue;
    }
    errors.push({
      path: `canonicalData.${storagePath}`,
      code: "VALIDATION_DEPRECATED_FIELDS_IN_PUBLISH",
      message: `Deprecated field "${storagePath}" cannot be present in a published template.`,
    });
  }

  return errors;
}

/**
 * Publish submit-gate: registry hygiene on sanitized canonical, hydrate seeds, then
 * evaluate required-field matrix using overlay-merged {@link DenaliRuleSet}
 * (headless — no React/RHF).
 */
export function collectWorkspaceWizardTemplatePublishErrors(
  nextOverlay: Record<string, unknown> | undefined,
  sanitizedCanonical: DenaliCanonicalTemplateData,
  profile?: TourFormProfile,
): ValidationFieldError[] {
  const deprecatedErrors = collectDeprecatedFieldsInPublish(sanitizedCanonical);
  if (deprecatedErrors.length > 0) {
    return deprecatedErrors;
  }

  const ruleSet = resolveDenaliRuleSetFromOverlay(nextOverlay ?? {});

  const hydrated = tryHydrateCanonicalTemplate(
    sanitizedCanonical,
    buildDenaliTourCreateDefaultValues(),
    undefined,
    ruleSet,
  );
  if (hydrated == null) {
    return [
      {
        path: "canonicalData",
        code: "VALIDATION_PUBLISH_HYDRATION_FAILED",
        message: "Template hydration failed on publish due to empty canonical content.",
      },
    ];
  }

  const uiOptions =
    profile != null ? { workspaceFormProfile: profile } : undefined;
  const submitIssues = getDenaliWizardSubmitIssues(hydrated.formValues, uiOptions, ruleSet);
  return mapSubmitIssuesToPublishErrors(submitIssues);
}

export function assertWorkspaceWizardTemplateValid(
  input: ValidateWorkspaceWizardTemplateInput,
): void {
  const errors = collectWorkspaceWizardTemplateValidationErrors(input);
  if (errors.length > 0) {
    throwValidationFailed(errors);
  }
}
