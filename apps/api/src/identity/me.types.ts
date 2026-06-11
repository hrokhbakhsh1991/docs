import type { ActorRole, MembershipStatus } from "@app-tour/workspace-sdk";

export type OperatorProfileResponse = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string | null;
  readonly mobile: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly avatarUrl: null;
};

export type PatchOperatorProfileRequest = {
  readonly displayName?: string;
};
