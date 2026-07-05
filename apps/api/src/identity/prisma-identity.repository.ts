import { randomUUID } from "node:crypto";

import type {
  ActorRole,
  OperatorMembershipAvatar,
  OperatorProfileGender,
} from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";
import type { InvitableWorkspaceRole } from "./users.types";
import { getPrisma } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import type {
  CreatePendingInviteInput,
  IdentityMembershipRecord,
  IdentityRepository,
  IdentityUserRecord,
  MembershipRewardsRecord,
  OtpChallengeRecord,
  PendingInviteRecord,
  RegisterPublicGuestInput,
  RegisterPublicGuestResult,
  UserRoleAuditInsert,
  UserRoleAuditRecord,
} from "./in-memory-identity.repository";
import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import { MobileAlreadyRegisteredError } from "./identity.errors";
import {
  InviteNotFoundError,
  MembershipNotFoundError,
  OwnershipTransferForbiddenError,
  OwnershipTransferTargetInvalidError,
} from "./in-memory-identity.repository";
import {
  mergeMembershipMetadata,
  readMembershipMetadata,
  writeMembershipMetadata,
  writePublicProfileMetadata,
} from "./membership-metadata";

function normalizeMobile(mobile: string): string {
  return canonicalizeLoginMobile(mobile);
}

function membershipKey(userId: string, tenantId: string): string {
  return `${userId}:${tenantId}`;
}

function toMembershipRecord(row: {
  userId: string;
  tenantId: string;
  role: string;
  status: string;
  sessionVersion: number;
  workspaceId: string | null;
  membershipMetadata: Prisma.JsonValue;
}): IdentityMembershipRecord {
  const metadata = readMembershipMetadata(row.membershipMetadata);
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    role: row.role as ActorRole,
    status: row.status as IdentityMembershipRecord["status"],
    sessionVersion: row.sessionVersion,
    ...(row.workspaceId !== null ? { workspaceId: row.workspaceId } : {}),
    ...(metadata.displayName !== undefined ? { displayName: metadata.displayName } : {}),
    ...(metadata.email !== undefined ? { email: metadata.email } : {}),
    ...(metadata.nationalId !== undefined ? { nationalId: metadata.nationalId } : {}),
    ...(metadata.fatherName !== undefined ? { fatherName: metadata.fatherName } : {}),
    ...(metadata.birthDate !== undefined ? { birthDate: metadata.birthDate } : {}),
    ...(metadata.gender !== undefined ? { gender: metadata.gender } : {}),
    ...(metadata.rewards !== undefined ? { rewards: metadata.rewards } : {}),
    ...(metadata.avatar !== undefined ? { avatar: metadata.avatar } : {}),
    ...(metadata.portalModuleGrants !== undefined && metadata.portalModuleGrants.length > 0
      ? { portalModuleGrants: metadata.portalModuleGrants }
      : {}),
  };
}

function toPendingInviteRecord(row: {
  inviteId: string;
  inviteToken: string;
  tenantId: string;
  phone: string;
  role: string;
  status: string;
  nameNote: string | null;
  invitedByUserId: string;
}): PendingInviteRecord {
  return {
    inviteId: row.inviteId,
    inviteToken: row.inviteToken,
    tenantId: row.tenantId,
    phone: row.phone,
    role: row.role as PendingInviteRecord["role"],
    status: "INVITED",
    ...(row.nameNote !== null && row.nameNote.length > 0 ? { nameNote: row.nameNote } : {}),
    invitedByUserId: row.invitedByUserId,
  };
}

export class PrismaIdentityRepository implements IdentityRepository {
  async findUserByMobile(mobile: string): Promise<IdentityUserRecord | null> {
    const row = await getPrisma().user.findUnique({
      where: { mobile: normalizeMobile(mobile) },
      select: { id: true, mobile: true },
    });
    return row === null ? null : { id: row.id, mobile: row.mobile };
  }

  async findUserById(userId: string): Promise<IdentityUserRecord | null> {
    const row = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true, mobile: true },
    });
    return row === null ? null : { id: row.id, mobile: row.mobile };
  }

  async findMembership(userId: string, tenantId: string): Promise<IdentityMembershipRecord | null> {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      })
    );
    return row === null ? null : toMembershipRecord(row);
  }

  async listMembershipsByTenant(tenantId: string): Promise<readonly IdentityMembershipRecord[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.userTenant.findMany({ where: { tenantId } })
    );
    return rows.map((row) => toMembershipRecord(row));
  }

  async createOtpChallenge(mobile: string, codeHash: string): Promise<{ challengeId: string }> {
    const id = randomUUID();
    await getPrisma().mobileOtpChallenge.create({
      data: {
        id,
        mobile: normalizeMobile(mobile),
        purpose: "login",
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
      },
    });
    return { challengeId: id };
  }

  async findOtpChallenge(challengeId: string): Promise<OtpChallengeRecord | null> {
    const row = await getPrisma().mobileOtpChallenge.findUnique({
      where: { id: challengeId.trim() },
    });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      mobile: row.mobile,
      purpose: "login",
      codeHash: row.codeHash,
      expiresAt: row.expiresAt,
      used: row.used,
    };
  }

  async markOtpChallengeUsed(challengeId: string): Promise<void> {
    await getPrisma().mobileOtpChallenge.updateMany({
      where: { id: challengeId.trim(), used: false },
      data: { used: true },
    });
  }

  async createPendingInvite(input: CreatePendingInviteInput): Promise<PendingInviteRecord> {
    const inviteId = randomUUID();
    const inviteToken = randomUUID();
    const row = await getPrisma().operatorPendingInvite.create({
      data: {
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
      },
    });
    return toPendingInviteRecord(row);
  }

  async listPendingInvitesByTenant(tenantId: string): Promise<readonly PendingInviteRecord[]> {
    const rows = await getPrisma().operatorPendingInvite.findMany({
      where: { tenantId, status: "INVITED" },
    });
    return rows.map((row) => toPendingInviteRecord(row));
  }

  async findPendingInvite(inviteId: string): Promise<PendingInviteRecord | null> {
    const row = await getPrisma().operatorPendingInvite.findUnique({
      where: { inviteId },
    });
    return row === null || row.status !== "INVITED" ? null : toPendingInviteRecord(row);
  }

  async findPendingInviteByToken(inviteToken: string): Promise<PendingInviteRecord | null> {
    const row = await getPrisma().operatorPendingInvite.findUnique({
      where: { inviteToken: inviteToken.trim() },
    });
    return row === null || row.status !== "INVITED" ? null : toPendingInviteRecord(row);
  }

  async acceptPendingInvite(
    inviteToken: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null> {
    const invite = await this.findPendingInviteByToken(inviteToken);
    if (invite === null) {
      return null;
    }

    const user = await this.findUserById(userId);
    if (user === null || normalizeMobile(user.mobile) !== invite.phone) {
      return null;
    }

    return withTenantRls(invite.tenantId, async (tx) => {
      const existing = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId: invite.tenantId } },
      });

      const membership: IdentityMembershipRecord =
        existing === null
          ? {
              userId,
              tenantId: invite.tenantId,
              role: invite.role,
              status: "ACTIVE",
              sessionVersion: 1,
              workspaceId: `ws-invite-${userId.slice(0, 8)}`,
            }
          : {
              ...toMembershipRecord(existing),
              role: invite.role,
              status: "ACTIVE",
              sessionVersion: existing.sessionVersion + 1,
            };

      await tx.userTenant.upsert({
        where: { userId_tenantId: { userId, tenantId: invite.tenantId } },
        create: {
          userId,
          tenantId: invite.tenantId,
          role: membership.role,
          status: membership.status,
          sessionVersion: membership.sessionVersion,
          workspaceId: membership.workspaceId ?? null,
          membershipMetadata: existing?.membershipMetadata ?? {},
        },
        update: {
          role: membership.role,
          status: membership.status,
          sessionVersion: membership.sessionVersion,
          ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
        },
      });

      await tx.operatorPendingInvite.delete({ where: { inviteId: invite.inviteId } });
      return membership;
    });
  }

  async revokePendingInvite(tenantId: string, inviteId: string): Promise<void> {
    const row = await getPrisma().operatorPendingInvite.findUnique({ where: { inviteId } });
    if (row === null || row.tenantId !== tenantId) {
      throw new InviteNotFoundError(inviteId);
    }
    await getPrisma().operatorPendingInvite.delete({ where: { inviteId } });
  }

  async updateMembershipRole(
    tenantId: string,
    userId: string,
    role: InvitableWorkspaceRole
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          role,
          sessionVersion: row.sessionVersion + 1,
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async updateMembershipStatus(
    tenantId: string,
    userId: string,
    status: Extract<IdentityMembershipRecord["status"], "ACTIVE" | "SUSPENDED">
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          status,
          sessionVersion: row.sessionVersion + 1,
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async removeMembership(tenantId: string, userId: string): Promise<void> {
    await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      await tx.userTenant.delete({ where: { userId_tenantId: { userId, tenantId } } });
    });
  }

  async updateMembershipRewards(
    tenantId: string,
    userId: string,
    rewards: MembershipRewardsRecord
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      const metadata = readMembershipMetadata(row.membershipMetadata);
      const mergedRewards = { ...metadata.rewards, ...rewards };
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          membershipMetadata: writeMembershipMetadata({
            ...(metadata.displayName !== undefined ? { displayName: metadata.displayName } : {}),
            rewards: mergedRewards,
          }),
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async updateMembershipDisplayName(
    tenantId: string,
    userId: string,
    displayName: string
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      const metadata = readMembershipMetadata(row.membershipMetadata);
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          membershipMetadata: mergeMembershipMetadata(row.membershipMetadata, {
            displayName: displayName.trim(),
          }),
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async updateMembershipProfileFields(
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
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          membershipMetadata: mergeMembershipMetadata(row.membershipMetadata, {
            ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
            ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
            ...("gender" in patch ? { gender: patch.gender ?? null } : {}),
            ...(patch.nationalId !== undefined ? { nationalId: patch.nationalId.trim() } : {}),
            ...(patch.fatherName !== undefined ? { fatherName: patch.fatherName.trim() } : {}),
            ...(patch.birthDate !== undefined ? { birthDate: patch.birthDate.trim() } : {}),
          }),
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async updateMembershipAvatar(
    tenantId: string,
    userId: string,
    avatar: OperatorMembershipAvatar | null
  ): Promise<IdentityMembershipRecord> {
    const updated = await withTenantRls(tenantId, async (tx) => {
      const row = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      if (row === null) {
        throw new MembershipNotFoundError(userId);
      }
      return tx.userTenant.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: {
          membershipMetadata: mergeMembershipMetadata(row.membershipMetadata, { avatar }),
        },
      });
    });
    return toMembershipRecord(updated);
  }

  async transferWorkspaceOwnership(
    tenantId: string,
    previousOwnerUserId: string,
    newOwnerUserId: string
  ): Promise<{ readonly previousOwnerUserId: string; readonly newOwnerUserId: string }> {
    return withTenantRls(tenantId, async (tx) => {
      const ownerRow = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId: previousOwnerUserId, tenantId } },
      });
      const targetRow = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId: newOwnerUserId, tenantId } },
      });
      if (ownerRow === null || ownerRow.role !== "owner") {
        throw new OwnershipTransferForbiddenError("OWNER_MEMBERSHIP_REQUIRED");
      }
      if (targetRow === null || targetRow.status !== "ACTIVE") {
        throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
      }
      if (targetRow.role === "owner") {
        throw new OwnershipTransferTargetInvalidError(newOwnerUserId);
      }

      await tx.userTenant.update({
        where: { userId_tenantId: { userId: previousOwnerUserId, tenantId } },
        data: { role: "admin", sessionVersion: ownerRow.sessionVersion + 1 },
      });
      await tx.userTenant.update({
        where: { userId_tenantId: { userId: newOwnerUserId, tenantId } },
        data: { role: "owner", sessionVersion: targetRow.sessionVersion + 1 },
      });

      return { previousOwnerUserId, newOwnerUserId };
    });
  }

  async insertUserRoleAuditEntry(row: UserRoleAuditInsert): Promise<void> {
    await withTenantRls(row.tenantId, async (tx) => {
      await tx.operatorUserRoleAudit.create({
        data: {
          id: randomUUID(),
          tenantId: row.tenantId,
          targetUserId: row.targetUserId,
          actorUserId: row.actorUserId,
          eventKind: row.eventKind ?? "role_change",
          oldRole: row.oldRole,
          newRole: row.newRole,
          ...(row.createdAt !== undefined ? { createdAt: row.createdAt } : {}),
        },
      });
    });
  }

  async listUserRoleHistoryRows(
    tenantId: string,
    targetUserId: string
  ): Promise<readonly UserRoleAuditRecord[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.operatorUserRoleAudit.findMany({
        where: { tenantId, targetUserId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        targetUserId: row.targetUserId,
        actorUserId: row.actorUserId,
        eventKind: row.eventKind as UserRoleAuditRecord["eventKind"],
        oldRole: row.oldRole,
        newRole: row.newRole,
        createdAt: row.createdAt,
      }));
    });
  }

  async registerPublicGuest(input: RegisterPublicGuestInput): Promise<RegisterPublicGuestResult> {
    const mobile = normalizeMobile(input.mobile);
    const displayName = input.displayName.trim();
    const email = input.email?.trim();

    let userRow = await getPrisma().user.findUnique({ where: { mobile } });
    if (userRow === null) {
      userRow = await getPrisma().user.create({ data: { mobile } });
    }
    const user: IdentityUserRecord = { id: userRow.id, mobile: userRow.mobile };

    const membership = await withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: input.tenantId } },
      });
      const workspaceId = existing?.workspaceId ?? `ws-public-${user.id.slice(0, 8)}`;
      const metadata = writePublicProfileMetadata({
        displayName,
        ...(email !== undefined && email.length > 0 ? { email } : {}),
        existingMetadata: existing?.membershipMetadata,
      });
      const role =
        existing !== null && (existing.role === "owner" || existing.role === "admin")
          ? existing.role
          : "member";

      const row = await tx.userTenant.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: input.tenantId } },
        create: {
          userId: user.id,
          tenantId: input.tenantId,
          role,
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId,
          membershipMetadata: metadata,
        },
        update: {
          status: "ACTIVE",
          sessionVersion: (existing?.sessionVersion ?? 0) + 1,
          membershipMetadata: metadata,
        },
      });
      return toMembershipRecord(row);
    });

    return { user, membership };
  }

  async updateUserMobile(userId: string, newMobile: string): Promise<IdentityUserRecord> {
    const normalized = normalizeMobile(newMobile);
    try {
      await getPrisma().$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { mobile: normalized } });
        if (existing !== null && existing.id !== userId) {
          throw new MobileAlreadyRegisteredError();
        }
        await tx.user.update({
          where: { id: userId },
          data: { mobile: normalized },
        });
        await tx.userTenant.updateMany({
          where: { userId },
          data: { sessionVersion: { increment: 1 } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new MobileAlreadyRegisteredError();
      }
      throw error;
    }
    const row = await getPrisma().user.findUnique({ where: { id: userId } });
    if (row === null) {
      throw new MembershipNotFoundError(userId);
    }
    return { id: row.id, mobile: row.mobile };
  }

  seedMembership(_record: IdentityMembershipRecord): void {
    throw new Error("IDENTITY_SEED_REQUIRES_MEMORY_DRIVER");
  }

  seedUser(_user: IdentityUserRecord): void {
    throw new Error("IDENTITY_SEED_REQUIRES_MEMORY_DRIVER");
  }

  seedPendingInvite(_record: PendingInviteRecord): void {
    throw new Error("IDENTITY_SEED_REQUIRES_MEMORY_DRIVER");
  }
}

export { membershipKey, normalizeMobile };
