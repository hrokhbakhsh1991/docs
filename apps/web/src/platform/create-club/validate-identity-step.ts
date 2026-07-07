import type { CreateClubDraft, WorkspaceOption } from "./use-create-club-wizard";

function isWorkspaceOptionProductionAllowed(option: WorkspaceOption): boolean {
  if (option.productionOnboardingAllowed === true) {
    return true;
  }
  return option.productionTier === "certified";
}

export function validateIdentityStep(
  draft: CreateClubDraft,
  workspaceOptions: readonly WorkspaceOption[]
): string | null {
  if (workspaceOptions.length === 0) {
    return "No workspaces available";
  }
  if (draft.workspaceType.trim().length === 0) {
    return "Select a workspace";
  }
  const selected = workspaceOptions.find((option) => option.id === draft.workspaceType);
  if (!selected) {
    return "Invalid workspace selection";
  }
  if (!isWorkspaceOptionProductionAllowed(selected)) {
    return "Selected workspace is not certified for production onboarding";
  }
  return null;
}
