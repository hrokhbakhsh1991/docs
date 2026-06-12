import { focusWizardField } from "./focus-wizard-field";
import type {
  FieldFocusRegistry,
  FocusWizardFieldOptions,
  GoToStepFn,
  ValidationIssue,
} from "./types";
import { waitForWizardFieldMarker } from "./wait-for-wizard-field";

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
    await waitForWizardFieldMarker(first.path, registry, {
      root: options?.root,
    });
  }

  return focusWizardField(first.path, registry, options);
}
