import type { DeepPartial, EntityManager, FindOptionsWhere, UpdateResult } from "typeorm";

import type { MembershipStatus } from "../../membership-status.enum";
import type {
  IdentityEmailVerificationTokenRecord,
  IdentityMembershipRecord,
  IdentityTenantRecord,
  IdentityUserRecord,
  IdentityWorkspaceInviteRecord,
  WorkspaceInviteStatus,
} from "../identity-records";
// depcruise no-folder-depth-gt-4: sibling import only — do not use ../domain/tenant-users-list.types
import type {
  TenantUsersListQuery,
  TenantUsersListRow,
} from "../tenant-users-list.types";
import type { TenantScopedUserRow } from "../../users/users-tenant-scope.types";
import type { UserBookingTripRowDto } from "../../dto/user-booking-trip-row.dto";

export const WORKSPACE_IDENTITY_REPOSITORY_PORT = Symbol("WORKSPACE_IDENTITY_REPOSITORY_PORT");

export type WorkspaceMemberListFilters = {
  limit?: number;
  status?: MembershipStatus;
};

export type WorkspaceIdentityRoleHistoryRow = {
  actor_user_id: string;
  actor_email: string;
  old_role: string;
  new_role: string;
  created_at: Date;
};

export type MemberWalletBalanceSnapshot = {
  balanceMinor: string;
  currency: string;
};

export type UserBookingSummarySnapshot = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
};

export type MembershipMetadataJsonbPatchInput = {
  membershipId: string;
  tenantId: string;
  patch?: Record<string, unknown>;
  removeKeys?: readonly string[];
};

export type UserRoleAuditInsertRow = {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  oldRole: string;
  newRole: string;
};

export type BulkUserMembershipSummaryRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  membership_status: MembershipStatus;
};

export type WorkspaceOwnershipTransferMutation = {
  tenantId: string;
  actorUserId: string;
  newOwnerUserId: string;
  actorMembershipId: string;
  targetMembershipId: string;
  actorPriorRole: string;
  targetPriorRole: string;
};

/**
 * Persistence port for workspace identity reads/writes (users, memberships, invites).
 * Application services depend on this interface; TypeORM lives only in adapters.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces
 * for {@link EntityManager}, {@link FindOptionsWhere}, etc. — see MAP §61.
 *
 * @see MAP §52 — `WorkspaceIdentityRepositoryPort`
 */
export interface WorkspaceIdentityRepositoryPort {
  findUserById(userId: string, manager?: EntityManager): Promise<IdentityUserRecord | null>;

  findActiveTenantById(
    tenantId: string
  ): Promise<Pick<IdentityTenantRecord, "id" | "enabledModules"> | null>;

  updateTenantEnabledModules(
    tenantId: string,
    enabledModules: readonly string[]
  ): Promise<string[]>;

  /** Email lookup (trimmed, lowercased equality on `users.email`). */
  findUserByEmail(email: string): Promise<IdentityUserRecord | null>;

  findActiveUserByEmailCaseInsensitive(
    email: string,
    manager?: EntityManager
  ): Promise<IdentityUserRecord | null>;

  findUserByEmailExact(email: string, manager?: EntityManager): Promise<IdentityUserRecord | null>;

  findUserByNationalIdActive(nationalId: string): Promise<IdentityUserRecord | null>;

  /** Cross-tenant phone match via `phone_normalized` (invite target resolution). */
  findUserByNormalizedPhone(phone: string): Promise<IdentityUserRecord | null>;

  findUserByNormalizedPhoneExclusive(
    phone: string,
    excludeUserId: string
  ): Promise<IdentityUserRecord | null>;

  saveUser(user: IdentityUserRecord, manager?: EntityManager): Promise<IdentityUserRecord>;

  deletePendingEmailVerificationTokens(userId: string, manager: EntityManager): Promise<void>;

  createEmailVerificationToken(
    data: DeepPartial<IdentityEmailVerificationTokenRecord>,
    manager: EntityManager
  ): IdentityEmailVerificationTokenRecord;

  saveEmailVerificationToken(
    row: IdentityEmailVerificationTokenRecord,
    manager: EntityManager
  ): Promise<IdentityEmailVerificationTokenRecord>;

  findLockedValidEmailVerificationToken(
    token: string,
    manager: EntityManager
  ): Promise<IdentityEmailVerificationTokenRecord | null>;

  findActiveMembership(
    tenantId: string,
    userId: string,
    options?: { status?: MembershipStatus },
    manager?: EntityManager
  ): Promise<IdentityMembershipRecord | null>;

  findActiveMembershipsByUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Array<Pick<IdentityMembershipRecord, "userId" | "role" | "membershipMetadata">>>;

  listWorkspaceMembers(
    tenantId: string,
    filters?: WorkspaceMemberListFilters
  ): Promise<IdentityMembershipRecord[]>;

  listTenantUsers(query: TenantUsersListQuery): Promise<TenantUsersListRow[]>;

  findTenantScopedUserRow(tenantId: string, userId: string): Promise<TenantScopedUserRow | null>;

  findPendingInviteByToken(token: string): Promise<IdentityWorkspaceInviteRecord | null>;

  saveInvite(
    invite: IdentityWorkspaceInviteRecord,
    manager?: EntityManager
  ): Promise<IdentityWorkspaceInviteRecord>;

  createInvite(data: DeepPartial<IdentityWorkspaceInviteRecord>): IdentityWorkspaceInviteRecord;

  findInviteById(tenantId: string, inviteId: string): Promise<IdentityWorkspaceInviteRecord | null>;

  findPendingInvitesByTenant(tenantId: string, now: Date): Promise<IdentityWorkspaceInviteRecord[]>;

  updateInviteStatus(id: string, status: WorkspaceInviteStatus, manager?: EntityManager): Promise<void>;

  saveMembership(
    membership: IdentityMembershipRecord,
    manager?: EntityManager
  ): Promise<IdentityMembershipRecord>;

  createMembership(data: DeepPartial<IdentityMembershipRecord>): IdentityMembershipRecord;

  deleteMembershipById(id: string, manager?: EntityManager): Promise<void>;

  removeInvite(invite: IdentityWorkspaceInviteRecord, manager?: EntityManager): Promise<void>;

  updateMembership(
    criteria: FindOptionsWhere<IdentityMembershipRecord>,
    partial: DeepPartial<IdentityMembershipRecord>
  ): Promise<UpdateResult>;

  findInvitedMembershipForPhone(
    tenantId: string,
    phone: string
  ): Promise<IdentityMembershipRecord | null>;

  listUserRoleHistoryRows(
    tenantId: string,
    userId: string
  ): Promise<WorkspaceIdentityRoleHistoryRow[]>;

  resolveOperatingCurrencyCode(tenantId: string): Promise<string>;

  loadMemberWalletBalances(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, MemberWalletBalanceSnapshot>>;

  loadBookingSummariesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, UserBookingSummarySnapshot>>;

  loadBookingTripsForUser(tenantId: string, userId: string): Promise<UserBookingTripRowDto[]>;

  applyMembershipMetadataJsonbPatch(
    manager: EntityManager,
    input: MembershipMetadataJsonbPatchInput
  ): Promise<void>;

  updateMembershipRoleWithSessionBump(
    manager: EntityManager,
    tenantId: string,
    membershipId: string,
    role: string
  ): Promise<void>;

  insertUserRoleAuditEntry(manager: EntityManager, row: UserRoleAuditInsertRow): Promise<void>;

  insertUserRoleAuditEntries(manager: EntityManager, rows: UserRoleAuditInsertRow[]): Promise<void>;

  bulkUpdateMembershipRoles(
    manager: EntityManager,
    tenantId: string,
    membershipIds: readonly string[],
    role: string
  ): Promise<void>;

  findActiveMembershipsByUserIdsInTransaction(
    manager: EntityManager,
    tenantId: string,
    userIds: readonly string[]
  ): Promise<IdentityMembershipRecord[]>;

  loadBulkUserMembershipSummaryRows(
    manager: EntityManager,
    tenantId: string,
    userIds: readonly string[]
  ): Promise<BulkUserMembershipSummaryRow[]>;

  deleteMembershipHard(manager: EntityManager, membershipId: string): Promise<void>;

  findActiveMembershipForUpdateLocking(
    manager: EntityManager,
    tenantId: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null>;

  updateMembershipLabels(
    manager: EntityManager,
    membershipId: string,
    tenantId: string,
    labels: string[]
  ): Promise<void>;

  executeWorkspaceOwnershipTransfer(
    manager: EntityManager,
    input: WorkspaceOwnershipTransferMutation
  ): Promise<void>;

  /** Escape hatch for complex membership / profile mutations. */
  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>;
}
