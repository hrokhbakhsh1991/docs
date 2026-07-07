import { resolveProductionCertificationForPlugin } from "@app-tour/workspace-sdk";

export type WorkspaceProductionTier = "stub" | "certified";

export function tryResolveWorkspaceProductionTier(
  workspaceType: string
): WorkspaceProductionTier | null {
  try {
    return resolveProductionCertificationForPlugin(workspaceType);
  } catch {
    return null;
  }
}

export function isWorkspaceProductionOnboardingAllowed(workspaceType: string): boolean {
  return tryResolveWorkspaceProductionTier(workspaceType) === "certified";
}
