"use client";

import type { ValidationResult } from "@app-tour/platform-core";
import {
  createDefaultFieldFocusRegistry,
  focusWizardField,
  mapValidationResultToIssues,
  scrollToFirstIssue,
  type FieldFocusRegistry,
  type FocusWizardFieldOptions,
  type GoToStepFn,
  type MapValidationResultOptions,
  type ValidationIssue,
} from "@app-tour/wizard-navigation";
import { useCallback, useMemo } from "react";

export type UseWizardStepValidationOptions = {
  readonly registry?: FieldFocusRegistry;
  readonly goToStep?: GoToStepFn;
  readonly focusOptions?: FocusWizardFieldOptions;
};

export function useWizardStepValidation(options: UseWizardStepValidationOptions = {}) {
  const registry = useMemo(
    () => options.registry ?? createDefaultFieldFocusRegistry(),
    [options.registry]
  );

  const focusField = useCallback(
    (path: string) => focusWizardField(path, registry, options.focusOptions),
    [registry, options.focusOptions]
  );

  const focusIssue = useCallback(
    async (issue: ValidationIssue) => scrollToFirstIssue([issue], registry, options.goToStep, options.focusOptions),
    [registry, options.goToStep, options.focusOptions]
  );

  const focusFirstFromResult = useCallback(
    async (result: ValidationResult, mapperOptions?: MapValidationResultOptions) => {
      const issues = mapValidationResultToIssues(result, mapperOptions);
      if (issues.length === 0) {
        return issues;
      }
      await scrollToFirstIssue(issues, registry, options.goToStep, options.focusOptions);
      return issues;
    },
    [registry, options.goToStep, options.focusOptions]
  );

  return {
    registry,
    focusField,
    focusIssue,
    focusFirstFromResult,
    mapValidationResultToIssues,
  };
}
