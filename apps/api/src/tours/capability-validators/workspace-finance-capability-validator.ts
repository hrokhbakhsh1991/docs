import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

/**
 * MAT-002 census: LEGITIMATE_NOOP for tour canonical pipeline.
 * Finance quotes/obligations validate on registration/finance HTTP paths — not tour persist.
 */
export function validateWorkspaceFinanceCapability(
  _ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  return null;
}
