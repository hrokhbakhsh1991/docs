import type { InvitableWorkspaceRole } from "./users-directory-types";

export type InviteRolePreviewCopy = {
  readonly line1Key: `inviteForm.preview.${InvitableWorkspaceRole}.line1`;
  readonly line2Key: `inviteForm.preview.${InvitableWorkspaceRole}.line2`;
};

export function resolveInviteRolePreviewKeys(
  role: InvitableWorkspaceRole
): InviteRolePreviewCopy {
  return {
    line1Key: `inviteForm.preview.${role}.line1`,
    line2Key: `inviteForm.preview.${role}.line2`,
  };
}
