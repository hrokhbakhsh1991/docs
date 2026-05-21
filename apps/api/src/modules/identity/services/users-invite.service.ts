import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "node:crypto";
import { IsNull, Repository } from "typeorm";
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
  WorkspaceInviteEntity,
  WorkspaceInviteStatus
} from "../entities/workspace-invite.entity";
import { UserEntity } from "../entities/user.entity";
import { UserTenantEntity } from "../entities/user-tenant.entity";

function assertInviteTargetMatchesUser(invite: WorkspaceInviteEntity, user: UserEntity): void {
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

@Injectable()
export class UsersInviteService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    @InjectRepository(WorkspaceInviteEntity)
    private readonly workspaceInviteRepository: Repository<WorkspaceInviteEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly membershipRepository: Repository<UserTenantEntity>
  ) {}

  async inviteUser(phone: string, role: string): Promise<InviteUserResult> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

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

    // tenant-isolation:qb-exempt — resolve user by phone across tenants; invite still tenant-scoped.
    const targetUser = await this.userRepository
      .createQueryBuilder("u")
      .where("u.deleted_at IS NULL")
      .andWhere("phone_normalized(COALESCE(u.phone, '')) = phone_normalized(:phone)", {
        phone: normalizedPhone
      })
      .getOne();

    if (targetUser) {
      const existingActiveMembership = await this.membershipRepository.findOne({
        where: {
          tenantId,
          userId: targetUser.id,
          deletedAt: IsNull(),
          status: MembershipStatus.ACTIVE
        }
      });
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

    const saved = await this.membershipRepository.manager.transaction(async (manager) => {
      const invite = await manager.save(
        manager.create(WorkspaceInviteEntity, {
          tenantId,
          email: normalizedPhone,
          role: normalizedRole,
          invitedByUserId: actorUserId,
          inviteToken,
          status: WorkspaceInviteStatus.PENDING,
          expiresAt,
          invitedAt: now
        })
      );

      let savedMembership: UserTenantEntity | null = null;
      if (targetUser) {
        const membershipRepo = manager.getRepository(UserTenantEntity);
        let membership = await membershipRepo.findOne({
          where: {
            tenantId,
            userId: targetUser.id,
            deletedAt: IsNull()
          }
        });

        if (!membership) {
          membership = membershipRepo.create({
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
        savedMembership = await membershipRepo.save(membership);
      }

      const actorLabelRecord = await manager.getRepository(UserEntity).findOne({
        where: { id: actorUserId, deletedAt: IsNull() }
      });
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

    const invite = await this.workspaceInviteRepository.findOne({
      where: { inviteToken }
    });
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
      await this.workspaceInviteRepository.update(
        { id: invite.id },
        { status: WorkspaceInviteStatus.EXPIRED }
      );
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

    const accepted = await this.membershipRepository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const inviteRepo = manager.getRepository(WorkspaceInviteEntity);
      const membershipRepo = manager.getRepository(UserTenantEntity);
      const user = await userRepo.findOne({
        where: { id: actorUserId, deletedAt: IsNull() }
      });
      if (!user) {
        throw new ForbiddenException({
          error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" }
        });
      }
      assertInviteTargetMatchesUser(invite, user);

      let membership = await membershipRepo.findOne({
        where: {
          tenantId: invite.tenantId,
          userId: user.id,
          deletedAt: IsNull()
        }
      });

      if (!membership) {
        membership = membershipRepo.create({
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
      const savedMembership = await membershipRepo.save(membership);

      invite.status = WorkspaceInviteStatus.ACCEPTED;
      await inviteRepo.remove(invite);

      const actorLabel = user.email;
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
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    const membership = await this.membershipRepository.findOne({
      where: {
        tenantId,
        userId,
        deletedAt: IsNull()
      }
    });
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

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
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

    const invite = await this.workspaceInviteRepository.save(
      this.workspaceInviteRepository.create({
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
    await this.membershipRepository.save(membership);

    const actorLabelRecord = await this.userRepository.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
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
}

