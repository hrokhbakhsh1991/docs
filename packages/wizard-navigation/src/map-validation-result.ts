import type { ValidationResult } from "@app-tour/platform-core";

import type { ValidationIssue } from "./types";

export type MapValidationResultOptions = {
  readonly resolveStepId?: (fieldId: string) => string | undefined;
};

export function mapValidationResultToIssues(
  result: ValidationResult,
  options?: MapValidationResultOptions
): readonly ValidationIssue[] {
  if (result.ok) {
    return [];
  }

  return result.violations.map((violation) => {
    const path = violation.fieldId ?? violation.code;
    const stepId =
      violation.fieldId !== undefined
        ? options?.resolveStepId?.(violation.fieldId)
        : undefined;
    return {
      path,
      message: violation.message,
      ...(stepId !== undefined ? { stepId } : {}),
    };
  });
}
