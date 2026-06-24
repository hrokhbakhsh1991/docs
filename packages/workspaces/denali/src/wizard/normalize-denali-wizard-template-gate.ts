import type {
  WorkspaceWizardTemplateGateNormalizeInput,
  WorkspaceWizardTemplateGateNormalizeResult,
} from "@app-tour/workspace-sdk";

import {
  ensureDenaliMatrixRequiredAllowedPaths,
  ensureDenaliMatrixRequiredTemplateSteps,
  ensureDenaliTourKindAllowedPaths,
  ensureDenaliTourKindTemplateSteps,
  type DenaliWizardTemplateStepRef,
} from "./ensure-tour-kind-template-field";
import { resolveDenaliWorkspaceFormProfile } from "./denali-wizard-rule-eval-context";

/** Phase 14.0b — inject tour-kind + matrix-required fields into tenant template overlay (INV-DENALI-WIZ-001 / 005). */
export function normalizeDenaliWizardTemplateGate(
  input: WorkspaceWizardTemplateGateNormalizeInput
): WorkspaceWizardTemplateGateNormalizeResult {
  const templateSteps = ensureDenaliMatrixRequiredTemplateSteps(
    ensureDenaliTourKindTemplateSteps(input.templateSteps as readonly DenaliWizardTemplateStepRef[])
  );
  const allowedCanonicalPaths = ensureDenaliMatrixRequiredAllowedPaths(
    ensureDenaliTourKindAllowedPaths(input.allowedCanonicalPaths)
  );
  const workspaceFormProfile = resolveDenaliWorkspaceFormProfile(input.workspaceFormProfile);

  return {
    templateSteps,
    allowedCanonicalPaths,
    workspaceFormProfile,
  };
}
