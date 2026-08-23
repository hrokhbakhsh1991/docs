/**
 * AUTO-GENERATED stub — CW8-02 placeholder until validation-pipeline codegen domain.
 * Regenerate: pnpm run generate:workspace-registry (CW8-02 domain TBD)
 */

import type { WorkspaceValidationPipelineStage } from "@app-tour/workspace-sdk";

export type CapabilityValidatorBinding = {
  readonly capabilityId: string;
  readonly run: WorkspaceValidationPipelineStage;
};

/** Manifest-ordered capability validators — empty until capability ports wire in. */
export const WORKSPACE_CAPABILITY_VALIDATORS: readonly CapabilityValidatorBinding[] = [];
