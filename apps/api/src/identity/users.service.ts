import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type {
  IdentityMembershipRecord,
  IdentityRepository,
  IdentityUserRecord,
  MembershipRewardsRecord,
} from "./in-memory-identity.repository";
import {
  InviteNotFoundError,
  InviteAlreadyPendingError,
  MembershipNotFoundError,
  OwnershipTransferForbiddenError,
  OwnershipTransferTargetInvalidError,
} from "./in-memory-identity.repository";
import { getIdentityRepository } from "./create-identity-repository";
import { createMobileOtpChallenge } from "./otp.service";
import type { PendingInviteRecord } from "./in-memory-identity.repository";
import { OPERATOR_INVITE_STATUS_INVITED } from "./invite-lifecycle";
import {
  compileUserBookingSummaryFromCounts,
} from "./compile-user-booking-summary";
import { MAX_MEMBER_BOOKINGS_RECENT_TRIPS } from "../bookings/bookings-member-summary-projection";
import { getBookingsRepository } from "../bookings/create-bookings-repository";
import { decodeUsersDirectoryCursor, encodeUsersDirectoryCursor } from "./users-directory-cursor";
import { normalizeMembershipRole } from "./hydrate-membership";
import { isLoginMobileFormatValid, normalizeLoginMobile } from "./phone-login-authorization";
import {
  evaluateMembershipRemoval,
  evaluateMembershipRoleChange,
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
  RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN,
  RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN,
  RBAC_SELF_ROLE_CHANGE_FORBIDDEN,
  type PatchableWorkspaceRole,
} from "./users-rbac.policy";
import {
  isInvitableWorkspaceRole,
  WORKSPACE_REWARD_BADGE_IDS,
  type InviteUserRequest,
  type InviteUserResponse,
  type PatchUserRoleRequest,
  type PatchUserRoleResponse,
  type PatchUserRewardsRequest,
  type PendingInviteRow,
  type ResendPendingInviteResponse,
  type TransferWorkspaceOwnershipResponse,
  type UserBookingSummaryResponse,
  type UserRoleHistoryItem,
  type UserRoleHistoryResponse,
  type PendingInvitesListResponse,
  type UsersDirectoryRow,
  type UsersListQuery,
  type UsersListResponse,
  type BulkUsersMutationFailure,
  type BulkUsersMutationResponse,
  type MembershipAuditEventKind,
} from "./users.types";
import { resolveOperatorAvatarUrlsForMemberships } from "./operator-avatar-storage";
import { assertOperatorUsersWorkspace } from "./users-workspace-guard";

export class UsersDirectoryForbiddenError extends Error {
  readonly code = "USERS_DIRECTORY_FORBIDDEN" as const;

  constructor() {
    super("USERS_DIRECTORY_FORBIDDEN");
    this.name = "UsersDirectoryForbiddenError";
  }
}

export class InviteRoleForbiddenError extends Error {
  readonly code = "INVITE_ROLE_FORBIDDEN" as const;

  constructor() {
    super("INVITE_ROLE_FORBIDDEN");
    this.name = "InviteRoleForbiddenError";
  }
}

export class InvitePhoneInvalidError extends Error {
  readonly code = "PHONE_INVALID" as const;

  constructor() {
    super("PHONE_INVALID");
    this.name = "InvitePhoneInvalidError";
  }
}

export class UsersRbacForbiddenError extends Error {
  readonly code:
    | typeof RBAC_SELF_ROLE_CHANGE_FORBIDDEN
    | typeof RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN
    | typeof RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN
    | typeof RBAC_INSUFFICIENT_ROLE_PRIVILEGE;

  constructor(code: UsersRbacForbiddenError["code"]) {
    super(code);
    this.name = "UsersRbacForbiddenError";
    this.code = code;
  }
}

async function assertUsersDirectoryAccess(auth: TenantAuthContext): Promise<void> {
  if (auth.role !== "owner") {
    throw new UsersDirectoryForbiddenError();
  }
  await assertOperatorUsersWorkspace(auth.tenantId);
}

async function appendMembershipAudit(
  repo: IdentityRepository,
  input: {
    readonly tenantId: string;
    readonly targetUserId: string;
    readonly actorUserId: string;
    readonly eventKind: MembershipAuditEventKind;
    readonly oldRole: string;
    readonly newRole: string;
  }
): Promise<void> {
  if (input.eventKind === "role_change" && input.oldRole === input.newRole) {
    return;
  }
  await repo.insertUserRoleAuditEntry(input);
}

function displayNameForUser(
  user: IdentityUserRecord,
  membership: IdentityMembershipRecord,
  nameNote?: string
): string {
  const profileName = membership.displayName?.trim();
  if (profileName !== undefined && profileName.length > 0) {
    return profileName;
  }
  const note = nameNote?.trim();
  if (note !== undefined && note.length > 0) {
    return note;
  }
  return user.mobile;
}

function buildDirectoryRow(
  user: IdentityUserRecord,
  membership: IdentityMembershipRecord,
  avatarUrl: string | null
): UsersDirectoryRow {
  const rewards = membership.rewards;
  return {
    userId: user.id,
    tenantId: membership.tenantId,
    role: normalizeMembershipRole(membership.role),
    status: membership.status,
    displayName: displayNameForUser(user, membership),
    phone: user.mobile,
    email: null,
    gender: membership.gender ?? null,
    avatarUrl,
    joinedAt: null,
    lastActiveAt: null,
    permanentDiscountPercentage: rewards?.permanentDiscountPercentage ?? null,
    rewardBadges: rewards?.badges ?? [],
    isSelectableLeader: rewards?.isSelectableLeader ?? false,
    labels: rewards?.labels ?? [],
  };
}

type MembershipWithUserPair = {
  readonly user: IdentityUserRecord;
  readonly membership: IdentityMembershipRecord;
};

async function directoryRowsFromPairs(
  pairs: readonly MembershipWithUserPair[]
): Promise<UsersDirectoryRow[]> {
  const avatarUrls = await resolveOperatorAvatarUrlsForMemberships(
    pairs.map(({ membership, user }) => ({
      tenantId: membership.tenantId,
      userId: user.id,
      storageKey: membership.avatar?.storageKey,
    }))
  );
  return pairs.map(({ membership, user }, index) =>
    buildDirectoryRow(user, membership, avatarUrls[index] ?? null)
  );
}

async function directoryRowFromPair(pair: MembershipWithUserPair): Promise<UsersDirectoryRow> {
  const [row] = await directoryRowsFromPairs([pair]);
  return row;
}

export async function listUsersDirectory(
  auth: TenantAuthContext,
  query: UsersListQuery,
  repo: IdentityRepository = getIdentityRepository()
): Promise<UsersListResponse> {
  await assertUsersDirectoryAccess(auth);

  const filters = {
    search: query.search,
    role: query.role,
    status: query.status,
  };
  const skip = decodeUsersDirectoryCursor(query.cursor);
  const [total, pairs] = await Promise.all([
    repo.countMembershipsDirectory(auth.tenantId, filters),
    repo.listMembershipsWithUsersDirectoryPage(
      auth.tenantId,
      filters,
      query.sort,
      skip,
      query.limit
    ),
  ]);

  const items = await directoryRowsFromPairs(pairs);
  const nextOffset = skip + items.length;
  const nextCursor =
    nextOffset < total ? encodeUsersDirectoryCursor(nextOffset) : undefined;

  return {
    items,
    total,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
}

export async function inviteWorkspaceUser(
  auth: TenantAuthContext,
  body: InviteUserRequest,
  repo: IdentityRepository = getIdentityRepository()
): Promise<InviteUserResponse> {
  await assertUsersDirectoryAccess(auth);

  if (!isInvitableWorkspaceRole(body.role)) {
    throw new InviteRoleForbiddenError();
  }

  const phone = normalizeLoginMobile(body.phone.trim());
  if (phone.length === 0) {
    throw new Error("PHONE_REQUIRED");
  }
  if (!isLoginMobileFormatValid(phone)) {
    throw new InvitePhoneInvalidError();
  }

  const created = await repo.createPendingInvite({
    tenantId: auth.tenantId,
    phone,
    role: body.role,
    nameNote: body.nameNote,
    invitedByUserId: auth.userId,
  });
  return {
    inviteId: created.inviteId,
    inviteToken: created.inviteToken,
    phone: created.phone,
    role: created.role,
    status: OPERATOR_INVITE_STATUS_INVITED,
  };
}

function toPendingInviteRow(record: PendingInviteRecord): PendingInviteRow {
  return {
    inviteId: record.inviteId,
    phone: record.phone,
    role: record.role,
    status: OPERATOR_INVITE_STATUS_INVITED,
    nameNote: record.nameNote ?? null,
    invitedByUserId: record.invitedByUserId,
  };
}

export async function listPendingInvites(
  auth: TenantAuthContext,
  repo: IdentityRepository = getIdentityRepository()
): Promise<PendingInvitesListResponse> {
  await assertUsersDirectoryAccess(auth);
  const items = (await repo.listPendingInvitesByTenant(auth.tenantId)).map((row) =>
    toPendingInviteRow(row)
  );
  return { items, total: items.length };
}

export async function revokePendingInvite(
  auth: TenantAuthContext,
  inviteId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  await assertUsersDirectoryAccess(auth);
  await repo.revokePendingInvite(auth.tenantId, inviteId);
}

export async function resendPendingInvite(
  auth: TenantAuthContext,
  inviteId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<ResendPendingInviteResponse> {
  await assertUsersDirectoryAccess(auth);
  const row = await repo.findPendingInvite(auth.tenantId, inviteId);
  if (row === null || row.tenantId !== auth.tenantId) {
    throw new InviteNotFoundError(inviteId);
  }
  await createMobileOtpChallenge(row.phone, repo);
  return { ...toPendingInviteRow(row), otpSent: true };
}

function assertPatchableRole(role: string): PatchableWorkspaceRole {
  if (!isInvitableWorkspaceRole(role)) {
    throw new UsersRbacForbiddenError(RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN);
  }
  return role;
}

async function patchWorkspaceUserRoleCore(
  auth: TenantAuthContext,
  targetUserId: string,
  newRole: PatchableWorkspaceRole,
  repo: IdentityRepository,
  prefetch?: BulkUserMutationPrefetch
): Promise<MembershipWithUserPair> {
  const membership =
    prefetch?.memberships.get(targetUserId) ??
    (await repo.findMembership(targetUserId, auth.tenantId));
  if (membership == null) {
    throw new MembershipNotFoundError(targetUserId);
  }

  const decision = evaluateMembershipRoleChange({
    actorUserId: auth.userId,
    actorRole: auth.role,
    targetUserId,
    targetCurrentRole: normalizeMembershipRole(membership.role),
    newRole,
  });
  if (!decision.ok) {
    throw new UsersRbacForbiddenError(decision.code);
  }

  const oldRole = normalizeMembershipRole(membership.role);
  const updated = await repo.updateMembershipRole(auth.tenantId, targetUserId, newRole);
  await appendMembershipAudit(repo, {
    tenantId: auth.tenantId,
    targetUserId,
    actorUserId: auth.userId,
    eventKind: "role_change",
    oldRole,
    newRole,
  });
  const user = await resolveUserForDirectoryRow(targetUserId, repo, prefetch);
  return { user, membership: updated };
}

export async function patchWorkspaceUserRole(
  auth: TenantAuthContext,
  targetUserId: string,
  body: PatchUserRoleRequest,
  repo: IdentityRepository = getIdentityRepository(),
  prefetch?: BulkUserMutationPrefetch
): Promise<PatchUserRoleResponse> {
  await assertUsersDirectoryAccess(auth);
  const newRole = assertPatchableRole(body.role);
  const pair = await patchWorkspaceUserRoleCore(auth, targetUserId, newRole, repo, prefetch);
  return directoryRowFromPair(pair);
}

export async function removeWorkspaceUser(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<void> {
  await assertUsersDirectoryAccess(auth);
  const membership = await repo.findMembership(targetUserId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(targetUserId);
  }

  const decision = evaluateMembershipRemoval({
    actorUserId: auth.userId,
    actorRole: auth.role,
    targetUserId,
    targetCurrentRole: normalizeMembershipRole(membership.role),
  });
  if (!decision.ok) {
    throw new UsersRbacForbiddenError(decision.code);
  }

  await appendMembershipAudit(repo, {
    tenantId: auth.tenantId,
    targetUserId,
    actorUserId: auth.userId,
    eventKind: "member_removed",
    oldRole: normalizeMembershipRole(membership.role),
    newRole: "REMOVED",
  });
  await repo.removeMembership(auth.tenantId, targetUserId);
}

export class MembershipStatusConflictError extends Error {
  readonly code: "MEMBERSHIP_ALREADY_SUSPENDED" | "MEMBERSHIP_NOT_SUSPENDED";

  constructor(code: MembershipStatusConflictError["code"]) {
    super(code);
    this.name = "MembershipStatusConflictError";
    this.code = code;
  }
}

async function assertManageableMembership(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository,
  prefetchedMembership?: IdentityMembershipRecord
): Promise<IdentityMembershipRecord> {
  const membership =
    prefetchedMembership ?? (await repo.findMembership(targetUserId, auth.tenantId));
  if (membership === null) {
    throw new MembershipNotFoundError(targetUserId);
  }

  const decision = evaluateMembershipRemoval({
    actorUserId: auth.userId,
    actorRole: auth.role,
    targetUserId,
    targetCurrentRole: normalizeMembershipRole(membership.role),
  });
  if (!decision.ok) {
    throw new UsersRbacForbiddenError(decision.code);
  }

  return membership;
}

async function suspendWorkspaceUserCore(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository,
  prefetch?: BulkUserMutationPrefetch
): Promise<MembershipWithUserPair> {
  const membership = await assertManageableMembership(
    auth,
    targetUserId,
    repo,
    prefetch?.memberships.get(targetUserId)
  );
  if (membership.status === "SUSPENDED") {
    throw new MembershipStatusConflictError("MEMBERSHIP_ALREADY_SUSPENDED");
  }

  const updated = await repo.updateMembershipStatus(auth.tenantId, targetUserId, "SUSPENDED");
  await appendMembershipAudit(repo, {
    tenantId: auth.tenantId,
    targetUserId,
    actorUserId: auth.userId,
    eventKind: "status_change",
    oldRole: "ACTIVE",
    newRole: "SUSPENDED",
  });
  const user = await resolveUserForDirectoryRow(targetUserId, repo, prefetch);
  return { user, membership: updated };
}

export async function suspendWorkspaceUser(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository = getIdentityRepository(),
  prefetch?: BulkUserMutationPrefetch
): Promise<UsersDirectoryRow> {
  await assertUsersDirectoryAccess(auth);
  const pair = await suspendWorkspaceUserCore(auth, targetUserId, repo, prefetch);
  return directoryRowFromPair(pair);
}

async function reactivateWorkspaceUserCore(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository,
  prefetch?: BulkUserMutationPrefetch
): Promise<MembershipWithUserPair> {
  const membership = await assertManageableMembership(
    auth,
    targetUserId,
    repo,
    prefetch?.memberships.get(targetUserId)
  );
  if (membership.status !== "SUSPENDED") {
    throw new MembershipStatusConflictError("MEMBERSHIP_NOT_SUSPENDED");
  }

  const updated = await repo.updateMembershipStatus(auth.tenantId, targetUserId, "ACTIVE");
  await appendMembershipAudit(repo, {
    tenantId: auth.tenantId,
    targetUserId,
    actorUserId: auth.userId,
    eventKind: "status_change",
    oldRole: "SUSPENDED",
    newRole: "ACTIVE",
  });
  const user = await resolveUserForDirectoryRow(targetUserId, repo, prefetch);
  return { user, membership: updated };
}

export async function reactivateWorkspaceUser(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository = getIdentityRepository(),
  prefetch?: BulkUserMutationPrefetch
): Promise<UsersDirectoryRow> {
  await assertUsersDirectoryAccess(auth);
  const pair = await reactivateWorkspaceUserCore(auth, targetUserId, repo, prefetch);
  return directoryRowFromPair(pair);
}

function normalizeRewardsPatch(body: PatchUserRewardsRequest): MembershipRewardsRecord {
  const rewards: MembershipRewardsRecord = {};
  if (body.permanentDiscountPercentage !== undefined) {
    const value = body.permanentDiscountPercentage;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
      throw new Error("REWARDS_DISCOUNT_INVALID");
    }
    rewards.permanentDiscountPercentage = value;
  }
  if (body.badges !== undefined) {
    const allowed = new Set<string>(WORKSPACE_REWARD_BADGE_IDS);
    if (body.badges.some((badge) => !allowed.has(badge))) {
      throw new Error("REWARDS_BADGE_INVALID");
    }
    rewards.badges = [...body.badges];
  }
  if (body.isSelectableLeader !== undefined) {
    rewards.isSelectableLeader = body.isSelectableLeader;
  }
  if (body.labels !== undefined) {
    if (
      body.labels.length > 32 ||
      body.labels.some((label) => label.trim().length === 0 || label.length > 64)
    ) {
      throw new Error("REWARDS_LABELS_INVALID");
    }
    rewards.labels = [...body.labels];
  }
  return rewards;
}

export async function patchWorkspaceUserRewards(
  auth: TenantAuthContext,
  targetUserId: string,
  body: PatchUserRewardsRequest,
  repo: IdentityRepository = getIdentityRepository()
): Promise<UsersDirectoryRow> {
  await assertUsersDirectoryAccess(auth);
  const membership = await repo.findMembership(targetUserId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(targetUserId);
  }
  if (membership.role === "owner") {
    throw new UsersRbacForbiddenError(RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
  }

  const rewards = normalizeRewardsPatch(body);
  const updated = await repo.updateMembershipRewards(auth.tenantId, targetUserId, rewards);
  await appendMembershipAudit(repo, {
    tenantId: auth.tenantId,
    targetUserId,
    actorUserId: auth.userId,
    eventKind: "rewards_change",
    oldRole: "rewards",
    newRole: "updated",
  });
  const user = await repo.findUserById(targetUserId);
  if (user === null) {
    throw new MembershipNotFoundError(targetUserId);
  }
  return directoryRowFromPair({ user, membership: updated });
}

export async function transferWorkspaceOwnership(
  auth: TenantAuthContext,
  tenantId: string,
  newOwnerUserId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<TransferWorkspaceOwnershipResponse> {
  if (auth.role !== "owner" || auth.tenantId !== tenantId) {
    throw new OwnershipTransferForbiddenError("OWNER_ONLY");
  }
  if (auth.userId === newOwnerUserId) {
    throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
  }

  const targetMembership = await repo.findMembership(newOwnerUserId, tenantId);
  if (targetMembership === null) {
    throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
  }
  const targetOldRole = normalizeMembershipRole(targetMembership.role);

  const result = await repo.transferWorkspaceOwnership(tenantId, auth.userId, newOwnerUserId);
  await appendMembershipAudit(repo, {
    tenantId,
    targetUserId: auth.userId,
    actorUserId: auth.userId,
    eventKind: "role_change",
    oldRole: "owner",
    newRole: "admin",
  });
  await appendMembershipAudit(repo, {
    tenantId,
    targetUserId: newOwnerUserId,
    actorUserId: auth.userId,
    eventKind: "role_change",
    oldRole: targetOldRole,
    newRole: "owner",
  });
  return {
    tenantId,
    previousOwnerUserId: result.previousOwnerUserId,
    newOwnerUserId: result.newOwnerUserId,
  };
}

export async function getWorkspaceUserRoleHistory(
  auth: TenantAuthContext,
  targetUserId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<UserRoleHistoryResponse> {
  await assertUsersDirectoryAccess(auth);
  const membership = await repo.findMembership(targetUserId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(targetUserId);
  }

  const rows = await repo.listUserRoleHistoryRows(auth.tenantId, targetUserId);
  const actorIds = [...new Set(rows.map((row) => row.actorUserId))];
  const actors = await repo.findUsersByIds(actorIds);
  const items: UserRoleHistoryItem[] = rows.map((row) => ({
    eventKind: row.eventKind ?? "role_change",
    actorUserId: row.actorUserId,
    actorMobile: actors.get(row.actorUserId)?.mobile ?? row.actorUserId,
    oldRole: row.oldRole,
    newRole: row.newRole,
    createdAt: row.createdAt.toISOString(),
  }));
  return { items };
}

export async function getWorkspaceUserBookingSummary(
  auth: TenantAuthContext,
  targetUserId: string
): Promise<UserBookingSummaryResponse> {
  await assertUsersDirectoryAccess(auth);
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(targetUserId, auth.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(targetUserId);
  }

  const bookingsRepo = getBookingsRepository();
  const now = new Date();
  const [totalTrips, cancelledTrips, completedTrips, recentTrips] = await Promise.all([
    bookingsRepo.countBookingsBySubmittedUser(auth.tenantId, targetUserId),
    bookingsRepo.countCancelledBookingsBySubmittedUser(auth.tenantId, targetUserId),
    bookingsRepo.countCompletedTripsBySubmittedUser(auth.tenantId, targetUserId, now),
    bookingsRepo.listRecentBySubmittedUser(
      auth.tenantId,
      targetUserId,
      MAX_MEMBER_BOOKINGS_RECENT_TRIPS
    ),
  ]);
  return compileUserBookingSummaryFromCounts(
    { totalTrips, completedTrips, cancelledTrips },
    recentTrips
  );
}

const BULK_USER_IDS_MAX = 50;

export class BulkUserIdsRequiredError extends Error {
  readonly code = "BULK_USER_IDS_REQUIRED" as const;

  constructor() {
    super("BULK_USER_IDS_REQUIRED");
    this.name = "BulkUserIdsRequiredError";
  }
}

export class BulkUserIdsLimitExceededError extends Error {
  readonly code = "BULK_USER_IDS_LIMIT_EXCEEDED" as const;

  constructor() {
    super("BULK_USER_IDS_LIMIT_EXCEEDED");
    this.name = "BulkUserIdsLimitExceededError";
  }
}

function normalizeBulkUserIds(userIds: readonly string[]): readonly string[] {
  const unique = [
    ...new Set(userIds.map((userId) => userId.trim()).filter((userId) => userId.length > 0)),
  ];
  if (unique.length === 0) {
    throw new BulkUserIdsRequiredError();
  }
  if (unique.length > BULK_USER_IDS_MAX) {
    throw new BulkUserIdsLimitExceededError();
  }
  return unique;
}

function bulkFailureCode(error: unknown): string {
  if (error instanceof UsersRbacForbiddenError) {
    return error.code;
  }
  if (error instanceof MembershipNotFoundError) {
    return error.code;
  }
  if (error instanceof MembershipStatusConflictError) {
    return error.code;
  }
  return "BULK_USER_MUTATION_FAILED";
}

export type BulkUserMutationPrefetch = {
  readonly memberships: ReadonlyMap<string, IdentityMembershipRecord>;
  readonly users: ReadonlyMap<string, IdentityUserRecord>;
};

async function loadBulkUserMutationPrefetch(
  auth: TenantAuthContext,
  userIds: readonly string[],
  repo: IdentityRepository
): Promise<BulkUserMutationPrefetch> {
  const [memberships, users] = await Promise.all([
    repo.findMembershipsByUserIds(auth.tenantId, userIds),
    repo.findUsersByIds(userIds),
  ]);
  return { memberships, users };
}

async function resolveUserForDirectoryRow(
  userId: string,
  repo: IdentityRepository,
  prefetch?: BulkUserMutationPrefetch
): Promise<IdentityUserRecord> {
  const cached = prefetch?.users.get(userId);
  if (cached !== undefined) {
    return cached;
  }
  const user = await repo.findUserById(userId);
  if (user === null) {
    throw new MembershipNotFoundError(userId);
  }
  return user;
}

async function runBulkMutation(
  auth: TenantAuthContext,
  userIds: readonly string[],
  repo: IdentityRepository,
  mutate: (
    userId: string,
    prefetch: BulkUserMutationPrefetch
  ) => Promise<MembershipWithUserPair>
): Promise<BulkUsersMutationResponse> {
  const prefetch = await loadBulkUserMutationPrefetch(auth, userIds, repo);
  const successPairs: MembershipWithUserPair[] = [];
  const failures: BulkUsersMutationFailure[] = [];
  for (const userId of userIds) {
    try {
      successPairs.push(await mutate(userId, prefetch));
    } catch (error: unknown) {
      failures.push({ userId, code: bulkFailureCode(error) });
    }
  }
  const items = await directoryRowsFromPairs(successPairs);
  return { items, failures };
}

export async function bulkPatchWorkspaceUserRoles(
  auth: TenantAuthContext,
  userIds: readonly string[],
  role: PatchableWorkspaceRole,
  repo: IdentityRepository = getIdentityRepository()
): Promise<BulkUsersMutationResponse> {
  await assertUsersDirectoryAccess(auth);
  const targets = normalizeBulkUserIds(userIds);
  return runBulkMutation(auth, targets, repo, (userId, prefetch) =>
    patchWorkspaceUserRoleCore(auth, userId, role, repo, prefetch)
  );
}

export async function bulkSuspendWorkspaceUsers(
  auth: TenantAuthContext,
  userIds: readonly string[],
  repo: IdentityRepository = getIdentityRepository()
): Promise<BulkUsersMutationResponse> {
  await assertUsersDirectoryAccess(auth);
  const targets = normalizeBulkUserIds(userIds);
  return runBulkMutation(auth, targets, repo, (userId, prefetch) =>
    suspendWorkspaceUserCore(auth, userId, repo, prefetch)
  );
}

export async function bulkReactivateWorkspaceUsers(
  auth: TenantAuthContext,
  userIds: readonly string[],
  repo: IdentityRepository = getIdentityRepository()
): Promise<BulkUsersMutationResponse> {
  await assertUsersDirectoryAccess(auth);
  const targets = normalizeBulkUserIds(userIds);
  return runBulkMutation(auth, targets, repo, (userId, prefetch) =>
    reactivateWorkspaceUserCore(auth, userId, repo, prefetch)
  );
}

export async function bulkRemoveWorkspaceUsers(
  auth: TenantAuthContext,
  userIds: readonly string[],
  repo: IdentityRepository = getIdentityRepository()
): Promise<BulkUsersMutationResponse> {
  await assertUsersDirectoryAccess(auth);
  const targets = normalizeBulkUserIds(userIds);
  const prefetch = await loadBulkUserMutationPrefetch(auth, targets, repo);
  const snapshotPairs: MembershipWithUserPair[] = [];
  const failures: BulkUsersMutationFailure[] = [];
  for (const userId of targets) {
    try {
      const membership = prefetch.memberships.get(userId);
      if (membership === undefined) {
        throw new MembershipNotFoundError(userId);
      }
      const user = prefetch.users.get(userId);
      if (user === undefined) {
        throw new MembershipNotFoundError(userId);
      }
      await removeWorkspaceUser(auth, userId, repo);
      snapshotPairs.push({ user, membership });
    } catch (error: unknown) {
      failures.push({ userId, code: bulkFailureCode(error) });
    }
  }
  const items = await directoryRowsFromPairs(snapshotPairs);
  return { items, failures };
}

export {
  InviteNotFoundError,
  InviteAlreadyPendingError,
  MembershipNotFoundError,
  OwnershipTransferForbiddenError,
  OwnershipTransferTargetInvalidError,
};
