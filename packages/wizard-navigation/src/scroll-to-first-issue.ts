import { focusWizardField } from "./focus-wizard-field";
import type {
  FieldFocusRegistry,
  FocusWizardFieldOptions,
  GoToStepFn,
  ValidationIssue,
} from "./types";

export async function scrollToFirstIssue(
  issues: readonly ValidationIssue[],
  registry: FieldFocusRegistry,
  goToStep?: GoToStepFn,
  options?: FocusWizardFieldOptions
): Promise<boolean> {
  const first = issues[0];
  if (first === undefined) {
    return false;
  }

  if (first.stepId !== undefined && goToStep !== undefined) {
    await goToStep(first.stepId);
  }

  return focusWizardField(first.path, registry, options);
}
