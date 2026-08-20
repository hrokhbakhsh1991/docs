/** AP15 — bounded identity directory / invite list reads. */
export const MAX_IDENTITY_MEMBERSHIPS_PER_TENANT = 500;
export const MAX_PENDING_INVITES_PER_TENANT = 200;

export const MEMBERSHIP_LIST_SELECT = {
  userId: true,
  tenantId: true,
  role: true,
  status: true,
  sessionVersion: true,
  workspaceId: true,
  membershipMetadata: true,
} as const;

export const PENDING_INVITE_LIST_SELECT = {
  inviteId: true,
  inviteToken: true,
  tenantId: true,
  phone: true,
  role: true,
  status: true,
  nameNote: true,
  invitedByUserId: true,
  createdAt: true,
  expiresAt: true,
} as const;
