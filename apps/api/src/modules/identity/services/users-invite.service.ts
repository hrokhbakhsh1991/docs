import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { TenantAuditAction } from "../../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../../common/audit/tenant-audit-events.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  evaluateWorkspaceInviteRole,
  normalizeWorkspaceMembershipRole
} from "../../../common/rbac/workspace-membership-rbac.policy";
import { normalizeOtpPhoneInput } from "../../../common/phone/otp-phone-normalize";
import { UsersAccessService } from "../users-access.service";
import type { AcceptInviteDto } from "../dto/accept-invite.dto";
import { MembershipStatus } from "../membership-status.enum";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort
} from "../domain/ports/workspace-identity-repository.port";
import {
  WorkspaceInviteStatus
} from "../entities/workspace-invite.entity";
import type {
  IdentityUserRecord,
  IdentityWorkspaceInviteRecord,
} from "../domain/identity-records";

function assertInviteTargetMatchesUser(
  invite: IdentityWorkspaceInviteRecord,
  user: IdentityUserRecord
): void {
  const inviteTarget = invite.email.trim().toLowerCase();
  if (inviteTarget.includes("@")) {
    const userEmail = (user.email ?? "").trim().toLowerCase();
    if (!userEmail || inviteTarget !== userEmail) {
      throw new ForbiddenException({
        error: {
          code: "INVITE_EMAIL_MISMATCH",
          message: "Invite was sent to a different email address"
        }
      });
    }
    return;
  }

  const invitePhone = normalizeOtpPhoneInput(invite.email);
  const userPhone = normalizeOtpPhoneInput(user.phone ?? "");
  if (!invitePhone || invitePhone !== userPhone) {
    throw new ForbiddenException({
      error: {
        code: "INVITE_PHONE_MISMATCH",
        message: "Invite was sent to a different phone number"
      }
    });
  }
}

export type InviteUserResult = {
  inviteId: string;
  tenantId: string;
  phone: string;
  role: string;
  inviteToken: string;
  status: WorkspaceInviteStatus;
  expiresAt: string;
  membershipStatus: MembershipStatus | null;
};

export type AcceptInviteResult = {
  tenantId: string;
  userId: string;
  role: string;
  membershipStatus: MembershipStatus;
  joinedAt: string;
  inviteStatus: WorkspaceInviteStatus;
};

export type ResendInviteResult = {
  inviteId: string;
  tenantId: string;
  userId: string;
  phone: string;
  role: string;
  inviteToken: string;
  status: WorkspaceInviteStatus;
  expiresAt: string;
  membershipStatus: MembershipStatus;
};

export type PendingWorkspaceInviteRow = {
  inviteId: string;
  phone: string;
  role: string;
  status: WorkspaceInviteStatus;
  expiresAt: string;
  invitedAt: string | null;
  userId: string | null;
};

export type CancelInviteResult = {
  inviteId: string;
  status: WorkspaceInviteStatus;
};

@Injectable()
export class UsersInviteService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort
  ) {}

  async inviteUser(phone: string, role: string): Promise<InviteUserResult> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const normalizedPhone = normalizeOtpPhoneInput(phone);
    const normalizedRole = normalizeWorkspaceMembershipRole(role);
    if (!normalizedPhone) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: "phone is required" }
      });
    }
    if (!normalizedRole) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: "role is invalid" }
      });
    }

    const inviteDecision = evaluateWorkspaceInviteRole({
      inviterRole: actorRole,
      invitedRole: normalizedRole
    });
    if (!inviteDecision.ok) {
      throw new ForbiddenException({
        error: { code: inviteDecision.code, message: inviteDecision.message }
      });
    }

    const targetUser = await this.identityRepository.findUserByNormalizedPhone(normalizedPhone);

    if (targetUser) {
      const existingActiveMembership = await this.identityRepository.findActiveMembership(
        tenantId,
        targetUser.id,
        { status: MembershipStatus.ACTIVE }
      );
      if (existingActiveMembership) {
        throw new BadRequestException({
          error: {
            code: "INVITE_ALREADY_ACTIVE_MEMBER",
            message: "User is already an active workspace member"
          }
        });
      }
    }

    const inviteToken = randomBytes(24).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const saved = await this.identityRepository.runInTransaction(async (manager) => {
      const invite = await this.identityRepository.saveInvite(
        this.identityRepository.createInvite({
          tenantId,
          email: normalizedPhone,
          role: normalizedRole,
          invitedByUserId: actorUserId,
          inviteToken,
          status: WorkspaceInviteStatus.PENDING,
          expiresAt,
          invitedAt: now
        }),
        manager
      );

      let savedMembership = null as Awaited<
        ReturnType<WorkspaceIdentityRepositoryPort["saveMembership"]>
      > | null;
      if (targetUser) {
        let membership = await this.identityRepository.findActiveMembership(
          tenantId,
          targetUser.id,
          undefined,
          manager
        );

        if (!membership) {
          membership = this.identityRepository.createMembership({
            tenantId,
            userId: targetUser.id,
            role: normalizedRole,
            status: MembershipStatus.INVITED,
            invitedAt: now,
            joinedAt: null,
            suspendedAt: null
          });
        } else {
          membership.role = normalizedRole;
          membership.status = MembershipStatus.INVITED;
          membership.invitedAt = now;
          membership.joinedAt = null;
          membership.suspendedAt = null;
        }
        savedMembership = await this.identityRepository.saveMembership(membership, manager);
      }

      const actorLabelRecord = await this.identityRepository.findUserById(actorUserId);
      const actorLabel = actorLabelRecord?.email ?? actorUserId;
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId: targetUser?.id ?? null,
          action: TenantAuditAction.USER_INVITED,
          resourceType: "workspace_invite",
          resourceId: invite.id,
          metadata: {
            actorUserId,
            targetUserId: targetUser?.id ?? null,
            tenantId,
            timestamp: now.toISOString(),
            details: {
              role: normalizedRole,
              inviteStatus: WorkspaceInviteStatus.PENDING,
              membershipStatus: savedMembership?.status ?? null,
              expiresAt: expiresAt.toISOString()
            }
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );

      return { invite, membership: savedMembership };
    });

    return {
      inviteId: saved.invite.id,
      tenantId: saved.invite.tenantId,
      phone: saved.invite.email,
      role: saved.invite.role,
      inviteToken: saved.invite.inviteToken,
      status: saved.invite.status,
      expiresAt: saved.invite.expiresAt.toISOString(),
      membershipStatus: saved.membership?.status ?? null
    };
  }

  async acceptInvite(
    dto: AcceptInviteDto,
    actorContext?: { actorUserId: string; clientIp?: string; requestId?: string }
  ): Promise<AcceptInviteResult> {
    const inviteToken = dto.inviteToken.trim();
    if (!inviteToken) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: "invite token is required" }
      });
    }

    const invite = await this.identityRepository.findPendingInviteByToken(inviteToken);
    if (!invite) {
      throw new NotFoundException({
        error: { code: "INVITE_NOT_FOUND", message: "Invite not found" }
      });
    }

    if (invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new BadRequestException({
        error: { code: "INVITE_NOT_PENDING", message: "Invite is not pending" }
      });
    }

    const now = new Date();
    if (invite.expiresAt.getTime() <= now.getTime()) {
      await this.identityRepository.updateInviteStatus(invite.id, WorkspaceInviteStatus.EXPIRED);
      throw new BadRequestException({
        error: { code: "INVITE_EXPIRED", message: "Invite has expired" }
      });
    }

    const normalizedRole = normalizeWorkspaceMembershipRole(invite.role);
    if (!normalizedRole) {
      throw new BadRequestException({
        error: { code: "INVITE_ROLE_INVALID", message: "Invite role is invalid" }
      });
    }

    const tenantAuditEvents = this.tenantAuditEventsService;
    const actorUserId = actorContext?.actorUserId?.trim() ?? this.requestContextService.getUserId();
    if (!actorUserId) {
      throw new ForbiddenException({
        error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" }
      });
    }
    const auditClientIp = actorContext?.clientIp ?? this.requestContextService.tryGetClientIp();
    const auditRequestId = actorContext?.requestId ?? this.requestContextService.tryGetRequestId();

    const accepted = await this.identityRepository.runInTransaction(async (manager) => {
      const user = await this.identityRepository.findUserById(actorUserId);
      if (!user) {
        throw new ForbiddenException({
          error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" }
        });
      }
      assertInviteTargetMatchesUser(invite, user);

      let membership = await this.identityRepository.findActiveMembership(
        invite.tenantId,
        user.id,
        undefined,
        manager
      );

      if (!membership) {
        membership = this.identityRepository.createMembership({
          tenantId: invite.tenantId,
          userId: user.id,
          role: normalizedRole,
          status: MembershipStatus.ACTIVE,
          invitedAt: invite.invitedAt ?? invite.createdAt,
          joinedAt: now,
          suspendedAt: null
        });
      } else {
        membership.role = normalizedRole;
        membership.status = MembershipStatus.ACTIVE;
        membership.joinedAt = now;
        membership.suspendedAt = null;
        if (!membership.invitedAt) {
          membership.invitedAt = invite.invitedAt ?? invite.createdAt;
        }
      }
      const savedMembership = await this.identityRepository.saveMembership(membership, manager);

      invite.status = WorkspaceInviteStatus.ACCEPTED;
      await this.identityRepository.removeInvite(invite, manager);

      const actorLabel = user.email ?? user.id;
      await tenantAuditEvents.append(
        {
          tenantId: invite.tenantId,
          actorUserId: user.id,
          actor: actorLabel,
          userId: user.id,
          action: TenantAuditAction.USER_JOINED,
          resourceType: "workspace_invite",
          resourceId: invite.id,
          metadata: {
            actorUserId: user.id,
            targetUserId: user.id,
            tenantId: invite.tenantId,
            timestamp: now.toISOString(),
            details: {
              role: normalizedRole,
              inviteStatus: WorkspaceInviteStatus.ACCEPTED,
              membershipStatus: MembershipStatus.ACTIVE,
              joinedAt: now.toISOString()
            }
          },
          clientIp: auditClientIp,
          requestId: auditRequestId
        },
        manager
      );

      return {
        user,
        membership: savedMembership,
        inviteStatus: WorkspaceInviteStatus.ACCEPTED,
        tenantId: invite.tenantId
      };
    });

    return {
      tenantId: accepted.tenantId,
      userId: accepted.user.id,
      role: accepted.membership.role,
      membershipStatus: accepted.membership.status,
      joinedAt: accepted.membership.joinedAt?.toISOString() ?? now.toISOString(),
      inviteStatus: accepted.inviteStatus
    };
  }

  async resendInvite(userId: string): Promise<ResendInviteResult> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const membership = await this.identityRepository.findActiveMembership(tenantId, userId, undefined);
    if (!membership) {
      throw new NotFoundException({
        error: { code: "MEMBERSHIP_NOT_FOUND", message: "Membership not found" }
      });
    }
    if (membership.status !== MembershipStatus.INVITED) {
      throw new BadRequestException({
        error: {
          code: "INVITE_RESEND_NOT_ALLOWED",
          message: "Invite can only be resent for invited memberships"
        }
      });
    }

    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    const normalizedPhone = normalizeOtpPhoneInput(user.phone ?? "");
    if (!normalizedPhone) {
      throw new BadRequestException({
        error: { code: "INVITE_PHONE_REQUIRED", message: "User must have a phone number to resend invite" }
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inviteToken = randomBytes(24).toString("hex");

    const invite = await this.identityRepository.saveInvite(
      this.identityRepository.createInvite({
        tenantId,
        email: normalizedPhone,
        role: membership.role,
        invitedByUserId: actorUserId,
        inviteToken,
        status: WorkspaceInviteStatus.PENDING,
        expiresAt,
        invitedAt: now
      })
    );

    membership.invitedAt = now;
    await this.identityRepository.saveMembership(membership);

    const actorLabelRecord = await this.identityRepository.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;
    await this.tenantAuditEventsService.append({
      tenantId,
      actorUserId,
      actor: actorLabel,
      userId: membership.userId,
      action: TenantAuditAction.USER_INVITE_RESENT,
      resourceType: "workspace_invite",
      resourceId: invite.id,
      metadata: {
        actorUserId,
        targetUserId: membership.userId,
        tenantId,
        timestamp: now.toISOString(),
        details: {
          role: membership.role,
          inviteStatus: WorkspaceInviteStatus.PENDING,
          membershipStatus: membership.status,
          expiresAt: expiresAt.toISOString()
        }
      },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return {
      inviteId: invite.id,
      tenantId: invite.tenantId,
      userId: membership.userId,
      phone: invite.email,
      role: invite.role,
      inviteToken: invite.inviteToken,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      membershipStatus: membership.status
    };
  }

  async listPendingInvites(): Promise<PendingWorkspaceInviteRow[]> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const now = new Date();
    const invites = await this.identityRepository.findPendingInvitesByTenant(tenantId, now);

    const rows: PendingWorkspaceInviteRow[] = [];
    for (const invite of invites) {
      const membership = await this.identityRepository.findInvitedMembershipForPhone(
        tenantId,
        invite.email
      );
      rows.push({
        inviteId: invite.id,
        phone: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        invitedAt: invite.invitedAt?.toISOString() ?? invite.createdAt.toISOString(),
        userId: membership?.userId ?? null
      });
    }
    return rows;
  }

  async cancelInvite(inviteId: string): Promise<CancelInviteResult> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const invite = await this.identityRepository.findInviteById(tenantId, inviteId);
    if (!invite || invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new NotFoundException({
        error: { code: "INVITE_NOT_FOUND", message: "Pending invite not found" }
      });
    }

    const membership = await this.identityRepository.findInvitedMembershipForPhone(
      tenantId,
      invite.email
    );
    const userId = membership?.userId ?? null;
    const now = new Date();

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.updateInviteStatus(
        invite.id,
        WorkspaceInviteStatus.EXPIRED,
        manager
      );
      if (userId && membership) {
        await this.identityRepository.deleteMembershipById(membership.id, manager);
      }

      const actorLabelRecord = await this.identityRepository.findUserById(actorUserId);
      const actorLabel = actorLabelRecord?.email ?? actorUserId;
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.USER_INVITED,
          resourceType: "workspace_invite",
          resourceId: invite.id,
          metadata: {
            cancelled: true,
            inviteStatus: WorkspaceInviteStatus.EXPIRED,
            timestamp: now.toISOString()
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );
    });

    return { inviteId: invite.id, status: WorkspaceInviteStatus.EXPIRED };
  }

  async resendInviteByInviteId(inviteId: string): Promise<ResendInviteResult> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const invite = await this.identityRepository.findInviteById(tenantId, inviteId);
    if (!invite || invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new NotFoundException({
        error: { code: "INVITE_NOT_FOUND", message: "Pending invite not found" }
      });
    }

    const now = new Date();
    if (invite.expiresAt.getTime() <= now.getTime()) {
      await this.identityRepository.updateInviteStatus(invite.id, WorkspaceInviteStatus.EXPIRED);
      throw new BadRequestException({
        error: { code: "INVITE_EXPIRED", message: "Invite has expired" }
      });
    }

    const membership = await this.identityRepository.findInvitedMembershipForPhone(
      tenantId,
      invite.email
    );
    const userId = membership?.userId ?? null;
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    invite.inviteToken = inviteToken;
    invite.expiresAt = expiresAt;
    invite.invitedAt = now;
    await this.identityRepository.saveInvite(invite);

    if (userId && membership) {
      membership.invitedAt = now;
      await this.identityRepository.saveMembership(membership);
    }

    const actorLabelRecord = await this.identityRepository.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;
    await this.tenantAuditEventsService.append({
      tenantId,
      actorUserId,
      actor: actorLabel,
      userId,
      action: TenantAuditAction.USER_INVITE_RESENT,
      resourceType: "workspace_invite",
      resourceId: invite.id,
      metadata: {
        actorUserId,
        targetUserId: userId,
        tenantId,
        timestamp: now.toISOString(),
        details: {
          role: invite.role,
          inviteStatus: WorkspaceInviteStatus.PENDING,
          expiresAt: expiresAt.toISOString()
        }
      },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return {
      inviteId: invite.id,
      tenantId: invite.tenantId,
      userId: userId ?? "",
      phone: invite.email,
      role: invite.role,
      inviteToken: invite.inviteToken,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      membershipStatus: MembershipStatus.INVITED
    };
  }
}
