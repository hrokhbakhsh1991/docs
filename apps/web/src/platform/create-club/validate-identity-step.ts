import type { CreateClubDraft, WorkspaceOption } from "./use-create-club-wizard";
import { validateSubdomainClient } from "./validate-subdomain";

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
  if (!workspaceOptions.some((option) => option.id === draft.workspaceType)) {
    return "Invalid workspace selection";
  }
  const subdomain = validateSubdomainClient(draft.subdomain);
  if (!subdomain.ok) {
    return subdomain.message;
  }
  return null;
}
