import {
  validateDenaliCanonicalTemplateData,
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

/** Server-side template payload validation (canonical + overlay enums). */
export function collectWorkspaceWizardTemplateValidationErrors(
  input: ValidateWorkspaceWizardTemplateInput,
): ValidationFieldError[] {
  const errors: ValidationFieldError[] = [];

  if (input.fieldRulesOverlay !== undefined) {
    errors.push(...validateOverlayRecord(input.fieldRulesOverlay));
  }

  if (input.canonicalData !== undefined) {
    const canonicalResult = validateDenaliCanonicalTemplateData(input.canonicalData);
    if (!canonicalResult.ok) {
      errors.push(...mapCanonicalIssues(canonicalResult.issues));
    }
  }

  return errors;
}

export function assertWorkspaceWizardTemplateValid(
  input: ValidateWorkspaceWizardTemplateInput,
): void {
  const errors = collectWorkspaceWizardTemplateValidationErrors(input);
  if (errors.length > 0) {
    throwValidationFailed(errors);
  }
}
