import type { ValidationResult } from "@app-tour/platform-core";

import type { ValidationIssue } from "./types";

export type MapValidationResultOptions = {
  readonly resolveStepId?: (fieldId: string) => string | undefined;
};

export type ValidationViolationLike = {
  readonly code: string;
  readonly fieldId?: string;
  readonly message: string;
};

/**
 * Stable key for merging canonical + publish-readiness (or any stacked layers).
 * First occurrence wins — preserves engine ordering.
 */
export function dedupeValidationViolations<T extends ValidationViolationLike>(
  violations: readonly T[]
): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const violation of violations) {
    const key = `${violation.fieldId ?? ""}:${violation.code}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(violation);
  }
  return out;
}

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
      code: violation.code,
      ...(stepId !== undefined ? { stepId } : {}),
    };
  });
}
