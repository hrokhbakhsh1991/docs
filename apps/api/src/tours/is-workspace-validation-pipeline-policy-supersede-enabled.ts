/** CW8-04/05 — per-workspace opt-in policy module supersedes flat hooks when pipeline + flag set. */
const POLICY_SUPERSEDE_ENV_KEYS: Readonly<Record<string, string>> = {
  denali: "WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY",
  urban: "WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY",
};

export function isWorkspaceValidationPipelinePolicySupersedeEnabled(
  workspaceType: string
): boolean {
  const envKey = POLICY_SUPERSEDE_ENV_KEYS[workspaceType];
  if (envKey === undefined) {
    return false;
  }
  return process.env[envKey]?.trim() === "1";
}
