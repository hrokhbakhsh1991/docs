import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

/**
 * MAT-002 census: LEGITIMATE_NOOP for tour canonical pipeline.
 * Booking create validation runs via `workspaceBooking.validationPolicy` adapters
 * on the registration path — not tour persist capability stage (CW8-01 §2.2).
 */
export function validateWorkspaceBookingCapability(
  _ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  return null;
}
