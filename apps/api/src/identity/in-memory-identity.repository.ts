import { randomUUID } from "node:crypto";

import type {
  MembershipStatus,
  OperatorMembershipAvatar,
  OperatorProfileGender,
} from "@app-tour/workspace-sdk";

import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import {
  computeInviteExpiresAt,
  isOperatorInviteActive,
  OPERATOR_INVITE_STATUS_ACCEPTED,
  OPERATOR_INVITE_STATUS_EXPIRED,
  OPERATOR_INVITE_STATUS_INVITED,
  OPERATOR_INVITE_STATUS_REVOKED,
  type OperatorInviteLifecycleStatus,
} from "./invite-lifecycle";
import { MobileAlreadyRegisteredError } from "./identity.errors";
import type { InvitableWorkspaceRole, UsersListQuery } from "./users.types";
import {
  INVITE_ACCEPT_MEMBERSHIP_EXISTS,
  INVITE_ACCEPT_OWNER_PROTECTED,
  INVITE_ALREADY_ACCEPTED,
  INVITE_ALREADY_PENDING,
  INVITE_EXPIRED,
  INVITE_REVOKED,
  assertOwnerCreateAllowed,
  evaluateInviteAccept,
  evaluateInviteCreate,
  evaluateInviteLifecycleForAccept,
  isActiveOwner,
} from "./users-rbac.policy";
import {
  matchesDirectoryPair,
  sortDirectoryPairs,
} from "./users-directory-query";
import type { UsersDirectoryListFilters } from "./users-directory-list-projection";
import type {
  IdentityMembershipRecord,
  IdentityUserRecord,
  MembershipRewardsRecord,
  MembershipWithUserRecord,
} from "./identity-membership-records.types";

export type {
  IdentityMembershipRecord,
  IdentityUserRecord,
  MembershipRewardsRecord,
  MembershipWithUserRecord,
} from "./identity-membership-records.types";

export type OtpChallengeRecord = {
  readonly id: string;
  readonly mobile: string;
  readonly purpose: "login";
  readonly codeHash: string;
  readonly expiresAt: Date;
  used: boolean;
};

export type PendingInviteRecord = {
  readonly inviteId: string;
  readonly inviteToken: string;
  readonly tenantId: string;
  readonly phone: string;
  /** Workspace invites: admin|member|viewer. Platform bootstrap may use owner. */
  readonly role: InvitableWorkspaceRole | "owner";
  readonly status: OperatorInviteLifecycleStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly nameNote?: string;
  readonly invitedByUserId: string;
};

export type CreatePendingInviteInput = {
  readonly tenantId: string;
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly nameNote?: string;
  readonly invitedByUserId: string;
};

export type MembershipAuditEventKind =
  | "role_change"
  | "status_change"
  | "rewards_change"
  | "member_removed";

export type UserRoleAuditInsert = {
  readonly tenantId: string;
  readonly targetUserId: string;
  readonly actorUserId: string;
  readonly eventKind?: MembershipAuditEventKind;
  readonly oldRole: string;
  readonly newRole: string;
  readonly createdAt?: Date;
};

export type UserRoleAuditRecord = UserRoleAuditInsert & {
  readonly id: string;
  readonly eventKind: MembershipAuditEventKind;
  readonly createdAt: Date;
};

export type RegisterPublicGuestInput = {
  readonly tenantId: string;
  readonly mobile: string;
  readonly displayName: string;
  readonly email?: string;
};

export type RegisterPublicGuestResult = {
  readonly user: IdentityUserRecord;
  readonly membership: IdentityMembershipRecord;
};

export type IdentityRepository = {
  findUserByMobile(mobile: string): Promise<IdentityUserRecord | null>;
  findUserById(userId: string): Promise<IdentityUserRecord | null>;
  findUsersByIds(userIds: readonly string[]): Promise<ReadonlyMap<string, IdentityUserRecord>>;
  findMembership(userId: string, tenantId: string): Promise<IdentityMembershipRecord | null>;
  findMembershipsByUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<ReadonlyMap<string, IdentityMembershipRecord>>;
  listMembershipsByTenant(tenantId: string): Promise<readonly IdentityMembershipRecord[]>;
  listMembershipsWithUsersByTenant(
    tenantId: string
  ): Promise<readonly MembershipWithUserRecord[]>;
  countMembershipsDirectory(
    tenantId: string,
    filters: UsersDirectoryListFilters
  ): Promise<number>;
  listMembershipsWithUsersDirectoryPage(
    tenantId: string,
    filters: UsersDirectoryListFilters,
    sort: UsersListQuery["sort"],
    skip: number,
    limit: number
  ): Promise<readonly MembershipWithUserRecord[]>;
  createOtpChallenge(mobile: string, codeHash: string): Promise<{ challengeId: string }>;
  findOtpChallenge(challengeId: string): Promise<OtpChallengeRecord | null>;
  markOtpChallengeUsed(challengeId: string): Promise<void>;
  createPendingInvite(input: CreatePendingInviteInput): Promise<PendingInviteRecord>;
  listPendingInvitesByTenant(tenantId: string): Promise<readonly PendingInviteRecord[]>;
  findPendingInviteByPhone(tenantId: string, phone: string): Promise<PendingInviteRecord | null>;
  findPendingInvite(tenantId: string, inviteId: string): Promise<PendingInviteRecord | null>;
  findPendingInviteByToken(
    tenantId: string,
    inviteToken: string
  ): Promise<PendingInviteRecord | null>;
  findInviteByToken(inviteToken: string): Promise<PendingInviteRecord | null>;
  findPendingInviteForAccept(inviteToken: string): Promise<PendingInviteRecord | null>;
  markInviteExpired(inviteId: string): Promise<void>;
  acceptPendingInvite(
    tenantId: string,
    inviteToken: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null>;
  revokePendingInvite(tenantId: string, inviteId: string): Promise<void>;
  updateMembershipRole(
    tenantId: string,
    userId: string,
    role: InvitableWorkspaceRole
  ): Promise<IdentityMembershipRecord>;
  updateMembershipStatus(
    tenantId: string,
    userId: string,
    status: Extract<MembershipStatus, "ACTIVE" | "SUSPENDED">
  ): Promise<IdentityMembershipRecord>;
  removeMembership(tenantId: string, userId: string): Promise<void>;
  updateMembershipRewards(
    tenantId: string,
    userId: string,
    rewards: MembershipRewardsRecord
  ): Promise<IdentityMembershipRecord>;
  updateMembershipDisplayName(
    tenantId: string,
    userId: string,
    displayName: string
  ): Promise<IdentityMembershipRecord>;
  updateMembershipProfileFields(
    tenantId: string,
    userId: string,
    patch: {
      readonly displayName?: string;
      readonly email?: string;
      readonly gender?: OperatorProfileGender | null;
      readonly nationalId?: string;
      readonly fatherName?: string;
      readonly birthDate?: string;
    }
  ): Promise<IdentityMembershipRecord>;
  updateMembershipAvatar(
    tenantId: string,
    userId: string,
    avatar: OperatorMembershipAvatar | null
  ): Promise<IdentityMembershipRecord>;
  updateMembershipPortalEntitlements(
    tenantId: string,
    userId: string,
    patch: {
      readonly portalModuleGrants: readonly string[];
      readonly portalPlanCode: string;
      readonly portalCapabilityFlags: Readonly<Record<string, boolean>>;
      readonly portalEntitlementsRevision: number;
    }
  ): Promise<IdentityMembershipRecord>;
  transferWorkspaceOwnership(
    tenantId: string,
    previousOwnerUserId: string,
    newOwnerUserId: string
  ): Promise<{ readonly previousOwnerUserId: string; readonly newOwnerUserId: string }>;
  insertUserRoleAuditEntry(row: UserRoleAuditInsert): Promise<void>;
  listUserRoleHistoryRows(
    tenantId: string,
    targetUserId: string
  ): Promise<readonly UserRoleAuditRecord[]>;
  registerPublicGuest(input: RegisterPublicGuestInput): Promise<RegisterPublicGuestResult>;
  updateUserMobile(userId: string, newMobile: string): Promise<IdentityUserRecord>;
  seedMembership(record: IdentityMembershipRecord): void;
  seedUser(user: IdentityUserRecord): void;
  seedPendingInvite(record: PendingInviteRecord): void;
};

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly usersByMobile = new Map<string, IdentityUserRecord>();
  private readonly usersById = new Map<string, IdentityUserRecord>();
  private readonly memberships = new Map<string, IdentityMembershipRecord>();
  private readonly challenges = new Map<string, OtpChallengeRecord>();
  private readonly invites = new Map<string, PendingInviteRecord>();
  private readonly invitesByToken = new Map<string, string>();
  private readonly invitesByTenantPhone = new Map<string, string>();
  private readonly roleAudits: UserRoleAuditRecord[] = [];

  static createWithDevSeed(): InMemoryIdentityRepository {
    const repo = new InMemoryIdentityRepository();
    const nodeEnv = process.env.NODE_ENV?.trim();
    if (nodeEnv === "development" || nodeEnv === "test") {
      seedOperatorSmokeDevFixture(repo);
      if (process.env.URBAN_SMOKE_E2E_SEED === "1") {
        seedUrbanSmokeE2eFixture(repo);
      }
    }
    return repo;
  }

  async findUserByMobile(mobile: string): Promise<IdentityUserRecord | null> {
    return this.usersByMobile.get(normalizeMobile(mobile)) ?? null;
  }

  async findUserById(userId: string): Promise<IdentityUserRecord | null> {
    return this.usersById.get(userId) ?? null;
  }

  async findUsersByIds(userIds: readonly string[]): Promise<ReadonlyMap<string, IdentityUserRecord>> {
    const map = new Map<string, IdentityUserRecord>();
    for (const userId of new Set(userIds)) {
      const user = this.usersById.get(userId);
      if (user !== undefined) {
        map.set(userId, user);
      }
    }
    return map;
  }

  async findMembership(userId: string, tenantId: string): Promise<IdentityMembershipRecord | null> {
    return this.memberships.get(membershipKey(userId, tenantId)) ?? null;
  }

  async findMembershipsByUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<ReadonlyMap<string, IdentityMembershipRecord>> {
    const map = new Map<string, IdentityMembershipRecord>();
    for (const userId of new Set(userIds)) {
      const membership = this.memberships.get(membershipKey(userId, tenantId));
      if (membership !== undefined) {
        map.set(userId, membership);
      }
    }
    return map;
  }

  async listMembershipsByTenant(tenantId: string): Promise<readonly IdentityMembershipRecord[]> {
    return [...this.memberships.values()].filter((row) => row.tenantId === tenantId);
  }

  async listMembershipsWithUsersByTenant(
    tenantId: string
  ): Promise<readonly MembershipWithUserRecord[]> {
    const memberships = await this.listMembershipsByTenant(tenantId);
    const pairs: MembershipWithUserRecord[] = [];
    for (const membership of memberships) {
      const user = await this.findUserById(membership.userId);
      if (user !== null) {
        pairs.push({ membership, user });
      }
    }
    return pairs;
  }

  async countMembershipsDirectory(
    tenantId: string,
    filters: UsersDirectoryListFilters
  ): Promise<number> {
    const pairs = await this.listMembershipsWithUsersByTenant(tenantId);
    return pairs.filter((pair) => matchesDirectoryPair(pair, filters)).length;
  }

  async listMembershipsWithUsersDirectoryPage(
    tenantId: string,
    filters: UsersDirectoryListFilters,
    sort: UsersListQuery["sort"],
    skip: number,
    limit: number
  ): Promise<readonly MembershipWithUserRecord[]> {
    const pairs = await this.listMembershipsWithUsersByTenant(tenantId);
    const filtered = pairs.filter((pair) => matchesDirectoryPair(pair, filters));
    const sorted = sortDirectoryPairs(filtered, sort);
    return sorted.slice(skip, skip + limit);
  }

  async createOtpChallenge(mobile: string, codeHash: string): Promise<{ challengeId: string }> {
    const id = randomUUID();
    const record: OtpChallengeRecord = {
      id,
      mobile: normalizeMobile(mobile),
      purpose: "login",
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
    };
    this.challenges.set(id, record);
    return { challengeId: id };
  }

  async findOtpChallenge(challengeId: string): Promise<OtpChallengeRecord | null> {
    return this.challenges.get(challengeId.trim()) ?? null;
  }

  async markOtpChallengeUsed(challengeId: string): Promise<void> {
    const row = this.challenges.get(challengeId.trim());
    if (row !== undefined) {
      row.used = true;
    }
  }

  async registerPublicGuest(input: RegisterPublicGuestInput): Promise<RegisterPublicGuestResult> {
    const mobile = normalizeMobile(input.mobile);
    const displayName = input.displayName.trim();
    let user = await this.findUserByMobile(mobile);
    if (user === null) {
      user = { id: randomUUID(), mobile };
      this.seedUser(user);
    }

    const key = membershipKey(user.id, input.tenantId);
    const existing = this.memberships.get(key);
    const profileEmail = input.email?.trim();
    const membership: IdentityMembershipRecord =
      existing === undefined
        ? {
            userId: user.id,
            tenantId: input.tenantId,
            role: "member",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: `ws-public-${user.id.slice(0, 8)}`,
            displayName,
            ...(profileEmail !== undefined && profileEmail.length > 0
              ? { email: profileEmail }
              : {}),
          }
        : {
            ...existing,
            status: "ACTIVE",
            sessionVersion: existing.sessionVersion + 1,
            displayName,
            ...(profileEmail !== undefined && profileEmail.length > 0
              ? { email: profileEmail }
              : {}),
            ...(existing.role === "owner" || existing.role === "admin"
              ? { role: existing.role }
              : { role: "member" as const }),
          };

    this.memberships.set(key, membership);
    return { user, membership };
  }

  async updateUserMobile(userId: string, newMobile: string): Promise<IdentityUserRecord> {
    const user = this.usersById.get(userId);
    if (user === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const normalized = normalizeMobile(newMobile);
    const existing = this.usersByMobile.get(normalized);
    if (existing !== undefined && existing.id !== userId) {
      throw new MobileAlreadyRegisteredError();
    }
    this.usersByMobile.delete(normalizeMobile(user.mobile));
    const updated: IdentityUserRecord = { id: userId, mobile: normalized };
    this.usersById.set(userId, updated);
    this.usersByMobile.set(normalized, updated);
    for (const [key, membership] of this.memberships.entries()) {
      if (membership.userId === userId) {
        this.memberships.set(key, {
          ...membership,
          sessionVersion: membership.sessionVersion + 1,
        });
      }
    }
    return updated;
  }

  seedMembership(record: IdentityMembershipRecord): void {
    this.memberships.set(membershipKey(record.userId, record.tenantId), record);
  }

  seedUser(user: IdentityUserRecord): void {
    const normalized = normalizeMobile(user.mobile);
    const stored = { ...user, mobile: normalized };
    this.usersByMobile.set(normalized, stored);
    this.usersById.set(user.id, stored);
  }

  async createPendingInvite(input: CreatePendingInviteInput): Promise<PendingInviteRecord> {
    const phone = normalizeMobile(input.phone);
    const now = new Date();
    const existing =
      [...this.invites.values()].find(
        (invite) =>
          invite.tenantId === input.tenantId &&
          invite.phone === phone &&
          isOperatorInviteActive(invite, now)
      ) ?? null;
    if (existing !== null) {
      assertInviteCreateDoesNotDuplicate(existing);
    }

    const inviteId = randomUUID();
    const inviteToken = randomUUID();
    const createdAt = new Date();
    const record: PendingInviteRecord = {
      inviteId,
      inviteToken,
      tenantId: input.tenantId,
      phone,
      role: input.role,
      status: OPERATOR_INVITE_STATUS_INVITED,
      createdAt,
      expiresAt: computeInviteExpiresAt(createdAt),
      ...(input.nameNote !== undefined && input.nameNote.trim().length > 0
        ? { nameNote: input.nameNote.trim() }
        : {}),
      invitedByUserId: input.invitedByUserId,
    };
    this.invites.set(inviteId, record);
    this.invitesByToken.set(inviteToken, inviteId);
    this.syncActiveInvitePhoneIndex(record);
    return record;
  }

  async listPendingInvitesByTenant(tenantId: string): Promise<readonly PendingInviteRecord[]> {
    const now = new Date();
    return [...this.invites.values()].filter(
      (row) => row.tenantId === tenantId && isOperatorInviteActive(row, now)
    );
  }

  async findPendingInviteByPhone(
    tenantId: string,
    phone: string
  ): Promise<PendingInviteRecord | null> {
    const normalized = normalizeMobile(phone);
    const now = new Date();
    const row =
      [...this.invites.values()].find(
        (invite) =>
          invite.tenantId === tenantId &&
          invite.phone === normalized &&
          isOperatorInviteActive(invite, now)
      ) ?? null;
    return row === null ? null : { ...row };
  }

  async findPendingInvite(
    tenantId: string,
    inviteId: string
  ): Promise<PendingInviteRecord | null> {
    const row = this.invites.get(inviteId);
    if (row === undefined || row.tenantId !== tenantId || !isOperatorInviteActive(row)) {
      return null;
    }
    return { ...row };
  }

  async findPendingInviteByToken(
    tenantId: string,
    inviteToken: string
  ): Promise<PendingInviteRecord | null> {
    const invite = await this.findInviteByToken(inviteToken);
    if (invite === null || invite.tenantId !== tenantId || !isOperatorInviteActive(invite)) {
      return null;
    }
    return invite;
  }

  async findInviteByToken(inviteToken: string): Promise<PendingInviteRecord | null> {
    const inviteId = this.invitesByToken.get(inviteToken.trim());
    if (inviteId === undefined) {
      return null;
    }
    const row = this.invites.get(inviteId);
    return row === undefined ? null : { ...row };
  }

  async findPendingInviteForAccept(inviteToken: string): Promise<PendingInviteRecord | null> {
    const invite = await this.findInviteByToken(inviteToken);
    if (invite === null || !isOperatorInviteActive(invite)) {
      return null;
    }
    return invite;
  }

  async markInviteExpired(inviteId: string): Promise<void> {
    const row = this.invites.get(inviteId);
    if (row === undefined || row.status !== OPERATOR_INVITE_STATUS_INVITED) {
      return;
    }
    const updated: PendingInviteRecord = {
      ...row,
      status: OPERATOR_INVITE_STATUS_EXPIRED,
    };
    this.invites.set(inviteId, updated);
    this.clearActiveInvitePhoneIndex(updated);
  }

  async acceptPendingInvite(
    tenantId: string,
    inviteToken: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null> {
    const invite = await this.findInviteByToken(inviteToken);
    if (invite === null || invite.tenantId !== tenantId) {
      return null;
    }

    const lifecycle = evaluateInviteLifecycleForAccept({
      status: invite.status,
      expiresAt: invite.expiresAt,
    });
    if (!lifecycle.ok) {
      if (lifecycle.code === INVITE_EXPIRED && invite.status === OPERATOR_INVITE_STATUS_INVITED) {
        await this.markInviteExpired(invite.inviteId);
      }
      throw new InviteLifecycleError(lifecycle.code, invite.inviteId);
    }

    const user = await this.findUserById(userId);
    if (user === null || normalizeMobile(user.mobile) !== invite.phone) {
      return null;
    }

    const key = membershipKey(userId, invite.tenantId);
    const existing = this.memberships.get(key);
    assertInviteAcceptCreatesMembership(existing === undefined ? null : existing.role);

    // P1.3-B write-boundary race guard — same evaluateOwnerCreate as service.
    if (invite.role === "owner") {
      let activeOwnerCount = 0;
      for (const row of this.memberships.values()) {
        if (row.tenantId === invite.tenantId && isActiveOwner({ role: row.role, status: row.status })) {
          activeOwnerCount += 1;
        }
      }
      assertOwnerCreateAllowed(activeOwnerCount);
    }

    const membership: IdentityMembershipRecord = {
      userId,
      tenantId: invite.tenantId,
      role: invite.role,
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: `ws-invite-${userId.slice(0, 8)}`,
    };

    this.memberships.set(key, membership);
    const accepted: PendingInviteRecord = {
      ...invite,
      status: OPERATOR_INVITE_STATUS_ACCEPTED,
    };
    this.invites.set(invite.inviteId, accepted);
    this.clearActiveInvitePhoneIndex(accepted);
    return membership;
  }

  async revokePendingInvite(tenantId: string, inviteId: string): Promise<void> {
    const row = this.invites.get(inviteId);
    if (row === undefined || row.tenantId !== tenantId || !isOperatorInviteActive(row)) {
      throw new InviteNotFoundError(inviteId);
    }
    const revoked: PendingInviteRecord = {
      ...row,
      status: OPERATOR_INVITE_STATUS_REVOKED,
    };
    this.invites.set(inviteId, revoked);
    this.clearActiveInvitePhoneIndex(revoked);
  }

  private syncActiveInvitePhoneIndex(invite: PendingInviteRecord): void {
    if (isOperatorInviteActive(invite)) {
      this.invitesByTenantPhone.set(pendingInvitePhoneKey(invite.tenantId, invite.phone), invite.inviteId);
    }
  }

  private clearActiveInvitePhoneIndex(invite: PendingInviteRecord): void {
    const phoneKey = pendingInvitePhoneKey(invite.tenantId, invite.phone);
    if (this.invitesByTenantPhone.get(phoneKey) === invite.inviteId) {
      this.invitesByTenantPhone.delete(phoneKey);
    }
  }

  async updateMembershipRole(
    tenantId: string,
    userId: string,
    role: InvitableWorkspaceRole
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord = {
      ...row,
      role,
      sessionVersion: row.sessionVersion + 1,
    };
    this.memberships.set(key, updated);
    return updated;
  }

  async updateMembershipStatus(
    tenantId: string,
    userId: string,
    status: Extract<MembershipStatus, "ACTIVE" | "SUSPENDED">
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord = {
      ...row,
      status,
      sessionVersion: row.sessionVersion + 1,
    };
    this.memberships.set(key, updated);
    return updated;
  }

  async removeMembership(tenantId: string, userId: string): Promise<void> {
    const key = membershipKey(userId, tenantId);
    if (!this.memberships.has(key)) {
      throw new MembershipNotFoundError(userId);
    }
    this.memberships.delete(key);
  }

  async updateMembershipRewards(
    tenantId: string,
    userId: string,
    rewards: MembershipRewardsRecord
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord = {
      ...row,
      rewards: { ...row.rewards, ...rewards },
    };
    this.memberships.set(key, updated);
    return updated;
  }

  async updateMembershipDisplayName(
    tenantId: string,
    userId: string,
    displayName: string
  ): Promise<IdentityMembershipRecord> {
    return this.updateMembershipProfileFields(tenantId, userId, { displayName });
  }

  async updateMembershipProfileFields(
    tenantId: string,
    userId: string,
    patch: {
      readonly displayName?: string;
      readonly email?: string | null;
      readonly gender?: OperatorProfileGender | null;
      readonly nationalId?: string;
      readonly fatherName?: string;
      readonly birthDate?: string;
    }
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    let updated: IdentityMembershipRecord = {
      ...row,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
      ...(patch.email !== undefined
        ? {
            email:
              patch.email === null || patch.email.trim().length === 0
                ? undefined
                : patch.email.trim(),
          }
        : {}),
      ...(patch.nationalId !== undefined ? { nationalId: patch.nationalId.trim() } : {}),
      ...(patch.fatherName !== undefined ? { fatherName: patch.fatherName.trim() } : {}),
      ...(patch.birthDate !== undefined ? { birthDate: patch.birthDate.trim() } : {}),
    };
    if (patch.gender === null) {
      updated = (({ gender: _removed, ...rest }) => rest)(updated);
    } else if (patch.gender !== undefined) {
      updated = { ...updated, gender: patch.gender };
    }
    this.memberships.set(key, updated);
    return updated;
  }

  async updateMembershipAvatar(
    tenantId: string,
    userId: string,
    avatar: OperatorMembershipAvatar | null
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord =
      avatar === null ? (({ avatar: _removed, ...rest }) => rest)({ ...row }) : { ...row, avatar };
    this.memberships.set(key, updated);
    return updated;
  }

  async updateMembershipPortalEntitlements(
    tenantId: string,
    userId: string,
    patch: {
      readonly portalModuleGrants: readonly string[];
      readonly portalPlanCode: string;
      readonly portalCapabilityFlags: Readonly<Record<string, boolean>>;
      readonly portalEntitlementsRevision: number;
    }
  ): Promise<IdentityMembershipRecord> {
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord = {
      ...row,
      portalModuleGrants: [...patch.portalModuleGrants],
      portalPlanCode: patch.portalPlanCode,
      portalCapabilityFlags: { ...patch.portalCapabilityFlags },
      portalEntitlementsRevision: patch.portalEntitlementsRevision,
    };
    this.memberships.set(key, updated);
    return updated;
  }

  async transferWorkspaceOwnership(
    tenantId: string,
    previousOwnerUserId: string,
    newOwnerUserId: string
  ): Promise<{ readonly previousOwnerUserId: string; readonly newOwnerUserId: string }> {
    const ownerKey = membershipKey(previousOwnerUserId, tenantId);
    const targetKey = membershipKey(newOwnerUserId, tenantId);
    const ownerRow = this.memberships.get(ownerKey);
    const targetRow = this.memberships.get(targetKey);
    if (ownerRow === undefined || ownerRow.role !== "owner") {
      throw new OwnershipTransferForbiddenError("OWNER_MEMBERSHIP_REQUIRED");
    }
    if (targetRow === undefined || targetRow.status !== "ACTIVE") {
      throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
    }
    if (targetRow.role === "owner") {
      throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
    }
    this.memberships.set(ownerKey, {
      ...ownerRow,
      role: "admin",
      sessionVersion: ownerRow.sessionVersion + 1,
    });
    this.memberships.set(targetKey, {
      ...targetRow,
      role: "owner",
      sessionVersion: targetRow.sessionVersion + 1,
    });
    return { previousOwnerUserId, newOwnerUserId };
  }

  async insertUserRoleAuditEntry(row: UserRoleAuditInsert): Promise<void> {
    this.roleAudits.push({
      id: randomUUID(),
      tenantId: row.tenantId,
      targetUserId: row.targetUserId,
      actorUserId: row.actorUserId,
      eventKind: row.eventKind ?? "role_change",
      oldRole: row.oldRole,
      newRole: row.newRole,
      createdAt: row.createdAt ?? new Date(),
    });
  }

  async listUserRoleHistoryRows(
    tenantId: string,
    targetUserId: string
  ): Promise<readonly UserRoleAuditRecord[]> {
    return this.roleAudits
      .filter((row) => row.tenantId === tenantId && row.targetUserId === targetUserId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 50);
  }

  seedPendingInvite(record: PendingInviteRecord): void {
    const stored = { ...record };
    this.invites.set(stored.inviteId, stored);
    this.invitesByToken.set(stored.inviteToken, stored.inviteId);
    this.syncActiveInvitePhoneIndex(stored);
  }
}

export class InviteNotFoundError extends Error {
  readonly code = "INVITE_NOT_FOUND" as const;

  constructor(readonly inviteId: string) {
    super(`INVITE_NOT_FOUND:${inviteId}`);
    this.name = "InviteNotFoundError";
  }
}

export class InviteAcceptConflictError extends Error {
  readonly code: typeof INVITE_ACCEPT_OWNER_PROTECTED | typeof INVITE_ACCEPT_MEMBERSHIP_EXISTS;

  constructor(code: InviteAcceptConflictError["code"]) {
    super(code);
    this.name = "InviteAcceptConflictError";
    this.code = code;
  }
}

export class InviteAlreadyPendingError extends Error {
  readonly code = INVITE_ALREADY_PENDING;

  constructor(readonly existingInvite: PendingInviteRecord) {
    super(INVITE_ALREADY_PENDING);
    this.name = "InviteAlreadyPendingError";
  }
}

export class InviteLifecycleError extends Error {
  readonly code: typeof INVITE_EXPIRED | typeof INVITE_REVOKED | typeof INVITE_ALREADY_ACCEPTED;

  constructor(
    code: InviteLifecycleError["code"],
    readonly inviteId: string
  ) {
    super(code);
    this.name = "InviteLifecycleError";
    this.code = code;
  }
}

export function assertInviteAcceptCreatesMembership(
  existingMembershipRole: string | null
): void {
  const decision = evaluateInviteAccept({ existingMembershipRole });
  if (!decision.ok) {
    throw new InviteAcceptConflictError(decision.code);
  }
}

export function assertInviteLifecycleAllowsAccept(invite: PendingInviteRecord): void {
  const decision = evaluateInviteLifecycleForAccept({
    status: invite.status,
    expiresAt: invite.expiresAt,
  });
  if (!decision.ok) {
    throw new InviteLifecycleError(decision.code, invite.inviteId);
  }
}

export function assertInviteCreateDoesNotDuplicate(existingInvite: PendingInviteRecord): void {
  const decision = evaluateInviteCreate({ existingPendingInvite: existingInvite });
  if (!decision.ok) {
    throw new InviteAlreadyPendingError(existingInvite);
  }
}

export class MembershipNotFoundError extends Error {
  readonly code = "MEMBERSHIP_NOT_FOUND" as const;

  constructor(readonly userId: string) {
    super(`MEMBERSHIP_NOT_FOUND:${userId}`);
    this.name = "MembershipNotFoundError";
  }
}

export class OwnershipTransferForbiddenError extends Error {
  readonly code = "OWNERSHIP_TRANSFER_FORBIDDEN" as const;

  constructor(readonly reason: string) {
    super(`OWNERSHIP_TRANSFER_FORBIDDEN:${reason}`);
    this.name = "OwnershipTransferForbiddenError";
  }
}

export class OwnershipTransferTargetInvalidError extends Error {
  readonly code = "OWNERSHIP_TRANSFER_TARGET_INVALID" as const;

  constructor(readonly userId: string) {
    super(`OWNERSHIP_TRANSFER_TARGET_INVALID:${userId}`);
    this.name = "OwnershipTransferTargetInvalidError";
  }
}

/** Phase 6.6 denali host — sync resolve-host-tenant.ts `denali` label */
const DENALI_DEV_HOST_TENANT_ID = "00000000-0000-4000-8000-000000000003";
/** Phase 8.4 urban smoke — sync URBAN_SMOKE_E2E fixture */
const URBAN_SMOKE_E2E_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_SMOKE_E2E_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_SMOKE_E2E_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";
const URBAN_SMOKE_E2E_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000402";
const URBAN_SMOKE_E2E_OWNER_MOBILE = "+15550004001";
const URBAN_SMOKE_E2E_MEMBER_MOBILE = "+15550004002";
/** Phase 9.8 operator smoke — sync OPERATOR_SMOKE.tenantId */
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE = "+15550001001";
const OPERATOR_SMOKE_ADMIN_MOBILE = "+15550001002";
const OPERATOR_SMOKE_MEMBER_MOBILE = "+15550001003";
const OPERATOR_SMOKE_INVITEE_USER_ID = "00000000-0000-4000-8000-000000000195";
const OPERATOR_SMOKE_INVITEE_MOBILE = "+15550008803";

function resolveOperatorSmokeOwnerSeed(): {
  readonly userId: string;
  readonly mobile: string;
  readonly displayName: string;
} {
  const mobile = process.env.OPERATOR_OWNER_MOBILE?.trim() || DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE;
  const userId = process.env.OPERATOR_OWNER_USER_ID?.trim() || OPERATOR_SMOKE_OWNER_USER_ID;
  const displayName = process.env.OPERATOR_OWNER_DISPLAY_NAME?.trim() || "Smoke Owner";
  return { userId, mobile, displayName };
}

function seedOperatorSmokeTeamRoster(repo: InMemoryIdentityRepository, tenantId: string): void {
  repo.seedUser({ id: OPERATOR_SMOKE_ADMIN_USER_ID, mobile: OPERATOR_SMOKE_ADMIN_MOBILE });
  repo.seedUser({ id: OPERATOR_SMOKE_MEMBER_USER_ID, mobile: OPERATOR_SMOKE_MEMBER_MOBILE });
  repo.seedMembership({
    userId: OPERATOR_SMOKE_ADMIN_USER_ID,
    tenantId,
    role: "admin",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-smoke-admin",
    displayName: "Smoke Admin",
  });
  repo.seedMembership({
    userId: OPERATOR_SMOKE_MEMBER_USER_ID,
    tenantId,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-smoke-member",
    displayName: "Smoke Member",
  });
}

function seedOperatorSmokeDevFixture(repo: InMemoryIdentityRepository): void {
  const owner = resolveOperatorSmokeOwnerSeed();
  repo.seedUser({ id: owner.userId, mobile: owner.mobile });
  repo.seedUser({ id: OPERATOR_SMOKE_INVITEE_USER_ID, mobile: OPERATOR_SMOKE_INVITEE_MOBILE });
  const ownerMembership = {
    userId: owner.userId,
    role: "owner" as const,
    status: "ACTIVE" as const,
    sessionVersion: 1,
    displayName: owner.displayName,
  };
  // Denali host login — operator.localhost / urban.localhost must not share this owner row.
  repo.seedMembership({
    ...ownerMembership,
    tenantId: DENALI_DEV_HOST_TENANT_ID,
    workspaceId: "ws-denali-dev",
  });

  // Playwright operator smoke (`OPERATOR_SMOKE_E2E_SEED=1`) binds bare localhost to …000014.
  if (process.env.OPERATOR_SMOKE_E2E_SEED === "1") {
    repo.seedMembership({
      ...ownerMembership,
      tenantId: OPERATOR_SMOKE_TENANT_ID,
      workspaceId: "ws-operator-smoke",
    });
    seedOperatorSmokeTeamRoster(repo, OPERATOR_SMOKE_TENANT_ID);
  }
}

function seedUrbanSmokeE2eFixture(repo: InMemoryIdentityRepository): void {
  repo.seedUser({ id: URBAN_SMOKE_E2E_OWNER_USER_ID, mobile: URBAN_SMOKE_E2E_OWNER_MOBILE });
  repo.seedUser({ id: URBAN_SMOKE_E2E_MEMBER_USER_ID, mobile: URBAN_SMOKE_E2E_MEMBER_MOBILE });
  repo.seedMembership({
    userId: URBAN_SMOKE_E2E_OWNER_USER_ID,
    tenantId: URBAN_SMOKE_E2E_TENANT_ID,
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: URBAN_SMOKE_E2E_WORKSPACE_ID,
    displayName: "Urban Smoke Owner",
  });
  repo.seedMembership({
    userId: URBAN_SMOKE_E2E_MEMBER_USER_ID,
    tenantId: URBAN_SMOKE_E2E_TENANT_ID,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: URBAN_SMOKE_E2E_WORKSPACE_ID,
    displayName: "Urban Smoke Member",
  });
}

function membershipKey(userId: string, tenantId: string): string {
  return `${userId}:${tenantId}`;
}

function pendingInvitePhoneKey(tenantId: string, phone: string): string {
  return `${tenantId}:${normalizeMobile(phone)}`;
}

function normalizeMobile(mobile: string): string {
  return canonicalizeLoginMobile(mobile);
}
