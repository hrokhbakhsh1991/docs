/** CW8-04 — opt-in Denali policy module supersedes flat hooks when pipeline + this flag are set. */
export function isWorkspaceValidationPipelineDenaliPolicyEnabled(): boolean {
  return process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY?.trim() === "1";
}
