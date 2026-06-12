import { randomUUID } from "node:crypto";

import type { ActorRole, MembershipStatus } from "@app-tour/workspace-sdk";

import type { InvitableWorkspaceRole } from "./users.types";

export type IdentityUserRecord = {
  readonly id: string;
  readonly mobile: string;
};

export type MembershipRewardsRecord = {
  readonly permanentDiscountPercentage?: number | null;
  readonly badges?: readonly string[];
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
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
  readonly rewards?: MembershipRewardsRecord;
};

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
  readonly role: InvitableWorkspaceRole;
  readonly status: "INVITED";
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
  findMembership(userId: string, tenantId: string): Promise<IdentityMembershipRecord | null>;
  listMembershipsByTenant(tenantId: string): Promise<readonly IdentityMembershipRecord[]>;
  createOtpChallenge(mobile: string, codeHash: string): Promise<{ challengeId: string }>;
  findOtpChallenge(challengeId: string): Promise<OtpChallengeRecord | null>;
  markOtpChallengeUsed(challengeId: string): Promise<void>;
  createPendingInvite(input: CreatePendingInviteInput): Promise<PendingInviteRecord>;
  listPendingInvitesByTenant(tenantId: string): Promise<readonly PendingInviteRecord[]>;
  findPendingInvite(inviteId: string): Promise<PendingInviteRecord | null>;
  findPendingInviteByToken(inviteToken: string): Promise<PendingInviteRecord | null>;
  acceptPendingInvite(
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
  private readonly roleAudits: UserRoleAuditRecord[] = [];

  static createWithDevSeed(): InMemoryIdentityRepository {
    const repo = new InMemoryIdentityRepository();
    const nodeEnv = process.env.NODE_ENV?.trim();
    if (nodeEnv === "development" || nodeEnv === "test") {
      seedOperatorSmokeDevFixture(repo);
    }
    return repo;
  }

  async findUserByMobile(mobile: string): Promise<IdentityUserRecord | null> {
    return this.usersByMobile.get(normalizeMobile(mobile)) ?? null;
  }

  async findUserById(userId: string): Promise<IdentityUserRecord | null> {
    return this.usersById.get(userId) ?? null;
  }

  async findMembership(userId: string, tenantId: string): Promise<IdentityMembershipRecord | null> {
    return this.memberships.get(membershipKey(userId, tenantId)) ?? null;
  }

  async listMembershipsByTenant(tenantId: string): Promise<readonly IdentityMembershipRecord[]> {
    return [...this.memberships.values()].filter((row) => row.tenantId === tenantId);
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
    const inviteId = randomUUID();
    const inviteToken = randomUUID();
    const record: PendingInviteRecord = {
      inviteId,
      inviteToken,
      tenantId: input.tenantId,
      phone: normalizeMobile(input.phone),
      role: input.role,
      status: "INVITED",
      ...(input.nameNote !== undefined && input.nameNote.trim().length > 0
        ? { nameNote: input.nameNote.trim() }
        : {}),
      invitedByUserId: input.invitedByUserId,
    };
    this.invites.set(inviteId, record);
    this.invitesByToken.set(inviteToken, inviteId);
    return record;
  }

  async listPendingInvitesByTenant(tenantId: string): Promise<readonly PendingInviteRecord[]> {
    return [...this.invites.values()].filter(
      (row) => row.tenantId === tenantId && row.status === "INVITED"
    );
  }

  async findPendingInvite(inviteId: string): Promise<PendingInviteRecord | null> {
    const row = this.invites.get(inviteId);
    return row === undefined ? null : { ...row };
  }

  async findPendingInviteByToken(inviteToken: string): Promise<PendingInviteRecord | null> {
    const inviteId = this.invitesByToken.get(inviteToken.trim());
    if (inviteId === undefined) {
      return null;
    }
    return this.findPendingInvite(inviteId);
  }

  async acceptPendingInvite(
    inviteToken: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null> {
    const invite = await this.findPendingInviteByToken(inviteToken);
    if (invite === null || invite.status !== "INVITED") {
      return null;
    }

    const user = await this.findUserById(userId);
    if (user === null || normalizeMobile(user.mobile) !== invite.phone) {
      return null;
    }

    const key = membershipKey(userId, invite.tenantId);
    const existing = this.memberships.get(key);
    const membership: IdentityMembershipRecord =
      existing === undefined
        ? {
            userId,
            tenantId: invite.tenantId,
            role: invite.role,
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: `ws-invite-${userId.slice(0, 8)}`,
          }
        : {
            ...existing,
            role: invite.role,
            status: "ACTIVE",
            sessionVersion: existing.sessionVersion + 1,
          };

    this.memberships.set(key, membership);
    this.invites.delete(invite.inviteId);
    this.invitesByToken.delete(invite.inviteToken);
    return membership;
  }

  async revokePendingInvite(tenantId: string, inviteId: string): Promise<void> {
    const row = this.invites.get(inviteId);
    if (row === undefined || row.tenantId !== tenantId) {
      throw new InviteNotFoundError(inviteId);
    }
    this.invites.delete(inviteId);
    this.invitesByToken.delete(row.inviteToken);
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
    const key = membershipKey(userId, tenantId);
    const row = this.memberships.get(key);
    if (row === undefined) {
      throw new MembershipNotFoundError(userId);
    }
    const updated: IdentityMembershipRecord = {
      ...row,
      displayName: displayName.trim(),
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
  }
}

export class InviteNotFoundError extends Error {
  readonly code = "INVITE_NOT_FOUND" as const;

  constructor(readonly inviteId: string) {
    super(`INVITE_NOT_FOUND:${inviteId}`);
    this.name = "InviteNotFoundError";
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
  const mobile =
    process.env.OPERATOR_OWNER_MOBILE?.trim() || DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE;
  const userId =
    process.env.OPERATOR_OWNER_USER_ID?.trim() || OPERATOR_SMOKE_OWNER_USER_ID;
  const displayName =
    process.env.OPERATOR_OWNER_DISPLAY_NAME?.trim() || "Smoke Owner";
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

function membershipKey(userId: string, tenantId: string): string {
  return `${userId}:${tenantId}`;
}

function normalizeMobile(mobile: string): string {
  return mobile.trim();
}
