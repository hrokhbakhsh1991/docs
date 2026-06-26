import type { ActorRole, MembershipStatus, OperatorProfileGender } from "@app-tour/workspace-sdk";

export type OperatorProfileResponse = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string | null;
  readonly mobile: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly gender: OperatorProfileGender | null;
  readonly avatarUrl: string | null;
};

export type PatchOperatorProfileRequest = {
  readonly displayName?: string;
  readonly gender?: OperatorProfileGender | null;
};
