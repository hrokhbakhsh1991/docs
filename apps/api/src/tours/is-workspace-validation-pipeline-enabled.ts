/** CW8-02 — opt-in staged validation pipeline (default: legacy flat path). */
export function isWorkspaceValidationPipelineEnabled(): boolean {
  return process.env.WORKSPACE_VALIDATION_PIPELINE?.trim() === "1";
}
