import type {
  ActorRole,
  MembershipStatus,
  OperatorMembershipAvatar,
  OperatorProfileGender,
} from "@app-tour/workspace-sdk";

export type IdentityUserRecord = {
  readonly id: string;
  readonly mobile: string;
};

export type MembershipRewardsRecord = {
  permanentDiscountPercentage?: number | null;
  badges?: string[];
  isSelectableLeader?: boolean;
  labels?: string[];
};

export type IdentityMembershipRecord = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly sessionVersion: number;
  readonly workspaceId?: string;
  readonly displayName?: string;
  readonly email?: string;
  readonly nationalId?: string;
  readonly fatherName?: string;
  readonly birthDate?: string;
  readonly gender?: OperatorProfileGender;
  readonly rewards?: MembershipRewardsRecord;
  readonly avatar?: OperatorMembershipAvatar;
  readonly portalModuleGrants?: readonly string[];
};

export type MembershipWithUserRecord = {
  readonly membership: IdentityMembershipRecord;
  readonly user: IdentityUserRecord;
};
