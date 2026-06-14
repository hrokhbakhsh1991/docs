import type { ValidationResult } from "@app-tour/platform-core";

export type WizardStepContinueGateInput = {
  readonly usesStepValidation: boolean;
  readonly stepId: string | undefined;
  readonly reviewStepId: string | undefined;
  readonly validate: (() => ValidationResult) | null;
};

/** TW-03 — block Continue until per-step validation passes (enterprise step gate). */
export function isWizardStepContinueBlocked(input: WizardStepContinueGateInput): boolean {
  if (!input.usesStepValidation || input.validate == null) {
    return false;
  }
  const stepId = input.stepId;
  if (stepId === undefined) {
    return false;
  }
  if (input.reviewStepId != null && stepId === input.reviewStepId) {
    return false;
  }
  return !input.validate().ok;
}
