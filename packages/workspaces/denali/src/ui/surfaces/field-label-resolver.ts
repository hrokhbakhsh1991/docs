import { resolveDenaliFieldLabel, resolveDenaliStepLabel } from "../adapters/field-labels";

import type { WizardLabelResolver } from "./wizard-surface-types";

export { resolveDenaliFieldLabel, resolveDenaliStepLabel } from "../adapters/field-labels";

/** Phase 14.0b — Denali field/step label resolver for manifest codegen. */
export function createDenaliFieldLabelResolver(): WizardLabelResolver {
  return Object.freeze({
    resolveFieldLabel: (translate, canonicalPath) =>
      resolveDenaliFieldLabel(translate, canonicalPath),
    resolveStepLabel: (translate, stepId) => resolveDenaliStepLabel(translate, stepId),
  });
}
