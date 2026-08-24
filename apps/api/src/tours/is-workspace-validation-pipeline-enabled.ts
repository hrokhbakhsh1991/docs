/** CW8-06 — staged validation pipeline is default; `WORKSPACE_VALIDATION_PIPELINE=0` opts out for rollback. */
export function isWorkspaceValidationPipelineEnabled(): boolean {
  return process.env.WORKSPACE_VALIDATION_PIPELINE?.trim() !== "0";
}
