import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DataSource, In, IsNull } from "typeorm";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import {
  authRequiredError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserRole, tryParseWorkspaceUserRole } from "../../common/auth/user-role.enum";
import { buildCapabilityGrantContextFromRequest } from "../../common/rbac/capability-grant-context-from-request";
import {
  assertCapabilityAssignable,
  buildMembershipMetadataFromAssignment,
} from "../../common/rbac/assert-capability-assignable";
import { evaluateGeneralMembershipRoleChange } from "../../common/rbac/workspace-membership-rbac.policy";
import type { PatchMembershipCapabilitiesDto } from "./dto/patch-membership-capabilities.dto";
import type {
  TransferWorkspaceOwnershipDto,
  TransferWorkspaceOwnershipResponseDto
} from "./dto/transfer-workspace-ownership.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import { MembershipStatus } from "./membership-status.enum";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserEntity } from "./entities/user.entity";
import { UsersAccessService } from "./users-access.service";

@Injectable()
export class UsersWriteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService,
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    private readonly access: UsersAccessService
  ) {}

  async updateMembershipCapabilities(
    tenantId: string,
    userId: string,
    payload: PatchMembershipCapabilitiesDto,
  ): Promise<UserResponseDto> {
    const contextTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied",
        },
      });
    }

    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() },
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const actorGrantContext = buildCapabilityGrantContextFromRequest(this.requestContextService);
    const decision = assertCapabilityAssignable({
      actorGrantContext,
      targetRole: membership.role,
      payload: {
        capabilities: payload.capabilities,
        allowedRegionIds: payload.allowedRegionIds,
      },
    });
    if (!decision.ok) {
      throw new ForbiddenException({
        error: {
          code: decision.code,
          message: decision.message,
        },
      });
    }

    const nextMetadata = buildMembershipMetadataFromAssignment(
      membership.membershipMetadata,
      decision,
    );

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() },
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_tenants SET membership_metadata = $1::jsonb, session_version = session_version + 1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [JSON.stringify(nextMetadata), membership.id, tenantId],
      );
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.MEMBERSHIP_CAPABILITIES_CHANGED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: {
            capabilities: decision.normalizedCapabilities,
            allowed_region_ids: decision.allowedRegionIds,
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId(),
        },
        manager,
      );
    });

    return this.access.toUserResponseDto(
      await this.access.findTenantScopedUserOrThrow(tenantId, userId),
    );
  }

  async updateUserRole(userId: string, role: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);
    const newRoleValue = tryParseWorkspaceUserRole(role);
    if (!newRoleValue) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ENUM_INVALID",
          message: "Unknown or unsupported workspace role"
        }
      });
    }

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const decision = evaluateGeneralMembershipRoleChange({
      actorUserId,
      actorRole,
      targetUserId: userId,
      targetCurrentRole: membership.role,
      newRole: newRoleValue
    });
    if (!decision.ok) {
      throw new ForbiddenException({
        error: {
          code: decision.code,
          message: decision.message
        }
      });
    }

    if (tryParseWorkspaceUserRole(membership.role) === newRoleValue) {
      return this.access.toUserResponseDto(
        await this.access.findTenantScopedUserOrThrow(tenantId, userId)
      );
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_tenants SET role = $1, session_version = session_version + 1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [newRoleValue, membership.id, tenantId]
      );
      await manager.insert(UserRoleAuditEntity, {
        tenantId,
        actorUserId,
        targetUserId: userId,
        oldRole: membership.role,
        newRole: newRoleValue
      });
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.MEMBERSHIP_ROLE_CHANGED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: {
            old_role: membership.role,
            new_role: newRoleValue,
            patch_scope: "single_user"
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );
    });

    return this.access.toUserResponseDto(
      await this.access.findTenantScopedUserOrThrow(tenantId, userId)
    );
  }

  async bulkUpdateUserRole(userIds: string[], role: string): Promise<UserResponseDto[]> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);
    const newRoleValue = tryParseWorkspaceUserRole(role);
    if (!newRoleValue) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ENUM_INVALID",
          message: "Unknown or unsupported workspace role"
        }
      });
    }

    const normalizedUserIds = Array.from(
      new Set(userIds.map((id) => id.trim()).filter((id) => id.length > 0))
    );
    if (normalizedUserIds.length === 0) {
      return [];
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;
    const clientIp = this.requestContextService.tryGetClientIp();
    const requestId = this.requestContextService.tryGetRequestId();

    return this.access.memberships.manager.transaction(async (manager) => {
      const memberships = await manager.find(UserTenantEntity, {
        where: { tenantId, userId: In(normalizedUserIds), deletedAt: IsNull() }
      });
      if (memberships.length !== normalizedUserIds.length) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      const membershipByUserId = new Map(
        memberships.map((membership) => [membership.userId, membership] as const)
      );

      for (const targetUserId of normalizedUserIds) {
        const membership = membershipByUserId.get(targetUserId);
        if (!membership) {
          throw new NotFoundException(tenantScopedResourceNotFoundError());
        }
        const decision = evaluateGeneralMembershipRoleChange({
          actorUserId,
          actorRole,
          targetUserId,
          targetCurrentRole: membership.role,
          newRole: newRoleValue
        });
        if (!decision.ok) {
          throw new ForbiddenException({
            error: {
              code: decision.code,
              message: decision.message
            }
          });
        }
      }

      const changedMemberships = memberships.filter(
        (membership) => tryParseWorkspaceUserRole(membership.role) !== newRoleValue
      );

      if (changedMemberships.length > 0) {
        await manager.query(
          `UPDATE user_tenants
             SET role = $1,
                 session_version = session_version + 1,
                 updated_at = now()
           WHERE tenant_id = $2
             AND deleted_at IS NULL
             AND id = ANY($3::uuid[])`,
          [newRoleValue, tenantId, changedMemberships.map((m) => m.id)]
        );

        await manager
          .createQueryBuilder()
          .insert()
          .into(UserRoleAuditEntity)
          .values(
            changedMemberships.map((membership) => ({
              tenantId,
              actorUserId,
              targetUserId: membership.userId,
              oldRole: membership.role,
              newRole: newRoleValue
            }))
          )
          .execute();

        await this.tenantAuditEventsService.appendMany(
          changedMemberships.map((membership) => ({
            tenantId,
            actorUserId,
            actor: actorLabel,
            userId: membership.userId,
            action: TenantAuditAction.MEMBERSHIP_ROLE_CHANGED,
            resourceType: "user_membership",
            resourceId: membership.id,
            metadata: {
              old_role: membership.role,
              new_role: newRoleValue,
              patch_scope: "bulk"
            },
            clientIp,
            requestId
          })),
          manager
        );
      }

      const users = await manager
        .createQueryBuilder(UserEntity, "u")
        .innerJoin(
          UserTenantEntity,
          "ut",
          "ut.user_id = u.id AND ut.tenant_id = :tenantId AND ut.deleted_at IS NULL",
          { tenantId }
        )
        .where("u.id IN (:...userIds)", { userIds: normalizedUserIds })
        .andWhere("u.deleted_at IS NULL")
        .select([
          "u.id AS id",
          "u.full_name AS full_name",
          "u.email AS email",
          "u.phone AS phone",
          "u.is_email_verified AS is_email_verified",
          "u.is_phone_verified AS is_phone_verified",
          "ut.membership_status AS membership_status"
        ])
        .getRawMany<{
          id: string;
          full_name: string | null;
          email: string;
          phone: string | null;
          is_email_verified: boolean;
          is_phone_verified: boolean;
          membership_status: MembershipStatus;
        }>();
      if (users.length !== normalizedUserIds.length) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      const userById = new Map(users.map((user) => [user.id, user] as const));

      return normalizedUserIds.map((targetUserId) => {
        const user = userById.get(targetUserId);
        const membership = membershipByUserId.get(targetUserId);
        if (!user || !membership) {
          throw new NotFoundException(tenantScopedResourceNotFoundError());
        }
        return this.access.toUserResponseDto({
          ...user,
          membership_status: user.membership_status,
          role:
            tryParseWorkspaceUserRole(membership.role) === newRoleValue
              ? membership.role
              : newRoleValue
        });
      });
    });
  }

  async suspendUserMembership(userId: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    if (actorUserId.trim() === userId.trim()) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_SELF_SUSPEND_FORBIDDEN",
          message: "You cannot suspend your own membership"
        }
      });
    }

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    if (tryParseWorkspaceUserRole(membership.role) === UserRole.Owner) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN",
          message: "Workspace owner cannot be suspended"
        }
      });
    }

    const decision = evaluateGeneralMembershipRoleChange({
      actorUserId,
      actorRole,
      targetUserId: userId,
      targetCurrentRole: membership.role,
      newRole: membership.role
    });
    if (!decision.ok) {
      throw new ForbiddenException({
        error: {
          code: decision.code,
          message: decision.message
        }
      });
    }

    if (membership.status !== MembershipStatus.SUSPENDED) {
      const now = new Date();
      const actorLabelRecord = await this.access.users.findOne({
        where: { id: actorUserId, deletedAt: IsNull() }
      });
      const actorLabel = actorLabelRecord?.email ?? actorUserId;
      await this.access.memberships.update(
        { id: membership.id, deletedAt: IsNull() },
        {
          status: MembershipStatus.SUSPENDED,
          suspendedAt: now
        }
      );
      await this.tenantAuditEventsService.append({
        tenantId,
        actorUserId,
        actor: actorLabel,
        userId,
        action: TenantAuditAction.USER_SUSPENDED,
        resourceType: "user_membership",
        resourceId: membership.id,
        metadata: {
          actorUserId,
          targetUserId: userId,
          tenantId,
          timestamp: now.toISOString(),
          details: {
            role: membership.role,
            fromStatus: membership.status,
            toStatus: MembershipStatus.SUSPENDED,
            suspendedAt: now.toISOString()
          }
        },
        clientIp: this.requestContextService.tryGetClientIp(),
        requestId: this.requestContextService.tryGetRequestId()
      });
    }

    return this.access.toUserResponseDto(
      await this.access.findTenantScopedUserOrThrow(tenantId, userId)
    );
  }

  async reactivateUserMembership(userId: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    if (membership.status !== MembershipStatus.SUSPENDED) {
      throw new BadRequestException({
        error: {
          code: "MEMBERSHIP_NOT_SUSPENDED",
          message: "Only suspended memberships can be reactivated"
        }
      });
    }

    const decision = evaluateGeneralMembershipRoleChange({
      actorUserId,
      actorRole,
      targetUserId: userId,
      targetCurrentRole: membership.role,
      newRole: membership.role
    });
    if (!decision.ok) {
      throw new ForbiddenException({
        error: {
          code: decision.code,
          message: decision.message
        }
      });
    }

    const now = new Date();
    await this.access.memberships.update(
      { id: membership.id, deletedAt: IsNull() },
      {
        status: MembershipStatus.ACTIVE,
        suspendedAt: null
      }
    );
    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;
    await this.tenantAuditEventsService.append({
      tenantId,
      actorUserId,
      actor: actorLabel,
      userId,
      action: TenantAuditAction.USER_REACTIVATED,
      resourceType: "user_membership",
      resourceId: membership.id,
      metadata: {
        actorUserId,
        targetUserId: userId,
        tenantId,
        timestamp: now.toISOString(),
        details: {
          role: membership.role,
          fromStatus: membership.status,
          toStatus: MembershipStatus.ACTIVE
        }
      },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return this.access.toUserResponseDto(
      await this.access.findTenantScopedUserOrThrow(tenantId, userId)
    );
  }

  async removeUserMembership(userId: string): Promise<void> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    if (actorUserId.trim() === userId.trim()) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_SELF_REMOVE_FORBIDDEN",
          message: "You cannot remove your own membership"
        }
      });
    }

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    if (tryParseWorkspaceUserRole(membership.role) === UserRole.Owner) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN",
          message: "Workspace owner cannot be removed"
        }
      });
    }

    const decision = evaluateGeneralMembershipRoleChange({
      actorUserId,
      actorRole,
      targetUserId: userId,
      targetCurrentRole: membership.role,
      newRole: membership.role
    });
    if (!decision.ok) {
      throw new ForbiddenException({
        error: {
          code: decision.code,
          message: decision.message
        }
      });
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(UserTenantEntity)
        .delete({ id: membership.id });

      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.USER_REMOVED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: {
            actorUserId,
            targetUserId: userId,
            tenantId,
            timestamp: new Date().toISOString(),
            details: {
              role: membership.role,
              status: membership.status
            }
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );
    });
  }

  async transferWorkspaceOwnership(
    tenantId: string,
    payload: TransferWorkspaceOwnershipDto
  ): Promise<TransferWorkspaceOwnershipResponseDto> {
    const contextTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied"
        }
      });
    }
    const actorUserId = this.requestContextService.getUserId();
    if (!actorUserId) {
      throw new ForbiddenException(authRequiredError());
    }
    const newOwnerUserId = payload.newOwnerUserId.trim();
    if (!newOwnerUserId) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "newOwnerUserId is required"
        }
      });
    }
    if (newOwnerUserId === actorUserId) {
      throw new BadRequestException({
        error: {
          code: "OWNER_TRANSFER_SELF_FORBIDDEN",
          message: "Ownership transfer target must be a different user."
        }
      });
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    return this.dataSource.transaction(async (manager) => {
      const actorMembership = await manager.findOne(UserTenantEntity, {
        where: { tenantId, userId: actorUserId, deletedAt: IsNull() },
        lock: { mode: "pessimistic_write" }
      });
      if (!actorMembership || tryParseWorkspaceUserRole(actorMembership.role) !== UserRole.Owner) {
        throw new ForbiddenException({
          error: {
            code: "OWNER_ONLY_TRANSFER",
            message: "Only the current workspace owner can transfer ownership."
          }
        });
      }

      const targetMembership = await manager.findOne(UserTenantEntity, {
        where: { tenantId, userId: newOwnerUserId, deletedAt: IsNull() },
        lock: { mode: "pessimistic_write" }
      });
      if (!targetMembership) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      await manager.query(
        `UPDATE user_tenants
           SET role = $1,
               session_version = session_version + 1,
               updated_at = now()
         WHERE id = $2 AND tenant_id = $3`,
        [UserRole.Admin, actorMembership.id, tenantId]
      );

      await manager.query(
        `UPDATE user_tenants
           SET role = $1,
               session_version = session_version + 1,
               updated_at = now()
         WHERE id = $2 AND tenant_id = $3`,
        [UserRole.Owner, targetMembership.id, tenantId]
      );

      await manager
        .createQueryBuilder()
        .insert()
        .into(UserRoleAuditEntity)
        .values([
          {
            tenantId,
            actorUserId,
            targetUserId: actorUserId,
            oldRole: actorMembership.role,
            newRole: UserRole.Admin
          },
          {
            tenantId,
            actorUserId,
            targetUserId: newOwnerUserId,
            oldRole: targetMembership.role,
            newRole: UserRole.Owner
          }
        ])
        .execute();

      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId: actorUserId,
          action: TenantAuditAction.WORKSPACE_OWNERSHIP_TRANSFERRED,
          resourceType: "workspace",
          resourceId: tenantId,
          metadata: {
            previous_owner_user_id: actorUserId,
            new_owner_user_id: newOwnerUserId,
            previous_owner_prior_role: actorMembership.role,
            new_owner_prior_role: targetMembership.role
          },
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );

      return {
        tenant_id: tenantId,
        previous_owner_user_id: actorUserId,
        new_owner_user_id: newOwnerUserId
      };
    });
  }
}
