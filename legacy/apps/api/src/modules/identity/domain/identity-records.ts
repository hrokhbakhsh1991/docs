import type { MembershipStatus } from "../membership-status.enum";

export enum WorkspaceInviteStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  EXPIRED = "EXPIRED",
}

/** Domain user row (infra {@link UserEntity} implements this shape). */
export type IdentityUserRecord = {
  id: string;
  email: string | null;
  phone?: string | null;
  telegramUserId?: string | null;
  hashedPassword: string;
  fullName?: string | null;
  nationalId?: string | null;
  gender?: string | null;
  birthDate?: Date | string | null;
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  notificationsEnabled?: boolean | null;
  profileRowVersion: number;
  lastLoginAt?: Date | null;
  lastActiveAt?: Date | null;
  profileImageUrl?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
  memberships?: unknown;
};

export type IdentityTenantRecord = {
  id: string;
  name: string;
  subdomain?: string | null;
  enabledModules: string[];
  deletedAt?: Date | null;
};

export type IdentityMembershipRecord = {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: MembershipStatus;
  invitedAt?: Date | null;
  joinedAt?: Date | null;
  suspendedAt?: Date | null;
  sessionVersion: number;
  labels: string[];
  membershipMetadata: Record<string, unknown>;
  deletedAt?: Date | null;
};

export type IdentityEmailVerificationTokenRecord = {
  id: string;
  userId: string;
  newEmail: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type IdentityWorkspaceInviteRecord = {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  invitedByUserId: string;
  inviteToken: string;
  status: WorkspaceInviteStatus;
  expiresAt: Date;
  invitedAt?: Date | null;
  createdAt: Date;
};
