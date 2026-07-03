import type {
  WorkspaceWizardTemplateGateNormalizeInput,
  WorkspaceWizardTemplateGateNormalizeResult,
} from "@app-tour/workspace-sdk";

import { resolveDenaliWorkspaceFormProfile } from "./denali-wizard-rule-eval-context";
import {
  ensureDenaliFrozenAllowedPaths,
  ensureDenaliFrozenTemplateSteps,
  ensureDenaliMatrixRequiredAllowedPaths,
  ensureDenaliMatrixRequiredTemplateSteps,
  type DenaliWizardTemplateStepRef,
} from "./ensure-tour-kind-template-field";

/** Phase 14.0b — inject frozen + matrix-required fields into tenant template overlay (INV-DENALI-WIZ-001 / 005 / 008). */
export function normalizeDenaliWizardTemplateGate(
  input: WorkspaceWizardTemplateGateNormalizeInput
): WorkspaceWizardTemplateGateNormalizeResult {
  const templateSteps = ensureDenaliMatrixRequiredTemplateSteps(
    ensureDenaliFrozenTemplateSteps(input.templateSteps as readonly DenaliWizardTemplateStepRef[])
  );
  const allowedCanonicalPaths = ensureDenaliMatrixRequiredAllowedPaths(
    ensureDenaliFrozenAllowedPaths(input.allowedCanonicalPaths)
  );
  const workspaceFormProfile = resolveDenaliWorkspaceFormProfile(input.workspaceFormProfile);

  return {
    templateSteps,
    allowedCanonicalPaths,
    workspaceFormProfile,
  };
}
