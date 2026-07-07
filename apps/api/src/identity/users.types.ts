import type { ActorRole, OperatorProfileGender } from "@app-tour/workspace-sdk";

import type { BookingPaymentStatus, BookingStatus } from "../bookings/bookings.types";

/** Roles an owner may assign on invite or PATCH (DEC-P9-019). */
export const INVITABLE_WORKSPACE_ROLES = ["admin", "member", "viewer"] as const;
export type InvitableWorkspaceRole = (typeof INVITABLE_WORKSPACE_ROLES)[number];

export function isInvitableWorkspaceRole(value: string): value is InvitableWorkspaceRole {
  return (INVITABLE_WORKSPACE_ROLES as readonly string[]).includes(value);
}

export const WORKSPACE_REWARD_BADGE_IDS = ["VIP_MEMBER", "GOLD_CLUB", "LEADER_BUDDY"] as const;
export type WorkspaceRewardBadgeId = (typeof WORKSPACE_REWARD_BADGE_IDS)[number];

export type UsersDirectoryRow = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: "ACTIVE" | "INVITED" | "SUSPENDED";
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly gender: OperatorProfileGender | null;
  readonly avatarUrl: string | null;
  readonly joinedAt: string | null;
  readonly lastActiveAt: string | null;
  readonly permanentDiscountPercentage: number | null;
  readonly rewardBadges: readonly string[];
  readonly isSelectableLeader: boolean;
  readonly labels: readonly string[];
};

export type UsersListStatusFilter = "all" | "active" | "suspended";

export type UsersListQuery = {
  readonly search?: string;
  readonly role?: "all" | "owner" | "admin" | "member" | "viewer";
  readonly status?: UsersListStatusFilter;
  readonly sort: "name_asc" | "name_desc" | "email_asc" | "email_desc";
  readonly limit: number;
  readonly cursor?: string;
};

export type UsersListResponse = {
  readonly items: readonly UsersDirectoryRow[];
  readonly total: number;
  readonly nextCursor?: string;
};

export type InviteUserRequest = {
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly nameNote?: string;
};

export type InviteUserResponse = {
  readonly inviteId: string;
  readonly inviteToken: string;
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly status: "INVITED";
};

export type AcceptInviteResponse = {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: ActorRole;
  readonly status: "ACTIVE";
  readonly inviteId: string;
};

export type PendingInviteRow = {
  readonly inviteId: string;
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly status: "INVITED";
  readonly nameNote: string | null;
  readonly invitedByUserId: string;
};

/** POST /users/invites/{id}/resend — OTP dispatched to invitee mobile (R6). */
export type ResendPendingInviteResponse = PendingInviteRow & {
  readonly otpSent: true;
};

export type PendingInvitesListResponse = {
  readonly items: readonly PendingInviteRow[];
  readonly total: number;
};

export type PatchUserRoleRequest = {
  readonly role: InvitableWorkspaceRole;
};

export type PatchUserRoleResponse = UsersDirectoryRow;

export type PatchUserRewardsRequest = {
  readonly permanentDiscountPercentage?: number | null;
  readonly badges?: readonly string[];
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
};

export type TransferWorkspaceOwnershipRequest = {
  readonly newOwnerUserId: string;
};

export type TransferWorkspaceOwnershipResponse = {
  readonly tenantId: string;
  readonly previousOwnerUserId: string;
  readonly newOwnerUserId: string;
};

export type MembershipAuditEventKind =
  | "role_change"
  | "status_change"
  | "rewards_change"
  | "member_removed";

export type UserRoleHistoryItem = {
  readonly eventKind: MembershipAuditEventKind;
  readonly actorUserId: string;
  readonly actorMobile: string;
  readonly oldRole: string;
  readonly newRole: string;
  readonly createdAt: string;
};

export type UserRoleHistoryResponse = {
  readonly items: readonly UserRoleHistoryItem[];
};

export type UserBookingTripRow = {
  readonly bookingId: string;
  readonly tourTitle: string;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly departureAt: string;
  readonly partySize: number;
};

export type UserBookingSummaryResponse = {
  readonly totalTrips: number;
  readonly completedTrips: number;
  readonly cancelledTrips: number;
  readonly trips: readonly UserBookingTripRow[];
};

export type BulkUsersMutationRequest = {
  readonly userIds: readonly string[];
};

export type BulkUsersRoleRequest = BulkUsersMutationRequest & {
  readonly role: InvitableWorkspaceRole;
};

export type BulkUsersMutationFailure = {
  readonly userId: string;
  readonly code: string;
};

export type BulkUsersMutationResponse = {
  readonly items: readonly UsersDirectoryRow[];
  readonly failures: readonly BulkUsersMutationFailure[];
};
