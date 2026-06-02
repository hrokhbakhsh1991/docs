import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { IsNull } from "typeorm";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import {
  authRequiredError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { tryParseWorkspaceUserRole } from "../../common/auth/user-role.enum";
import {
  isProtectedWorkspaceOwnerMembership,
  isWorkspaceOwner
} from "../../common/rbac/workspace-access.helper";
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
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort
} from "./domain/ports/workspace-identity-repository.port";
import { MembershipStatus } from "./membership-status.enum";
import { UsersAccessService } from "./users-access.service";

@Injectable()
export class UsersWriteService {
  constructor(
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort,
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
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const membership = await this.access.findMembership(tenantId, userId);
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
    const metadataPatch: Record<string, unknown> = {};
    const metadataRemoveKeys: string[] = [];
    if (Object.prototype.hasOwnProperty.call(nextMetadata, "capabilities")) {
      metadataPatch.capabilities = nextMetadata.capabilities;
    } else {
      metadataRemoveKeys.push("capabilities");
    }
    if (Object.prototype.hasOwnProperty.call(nextMetadata, "allowedRegionIds")) {
      metadataPatch.allowedRegionIds = nextMetadata.allowedRegionIds;
    } else {
      metadataRemoveKeys.push("allowedRegionIds");
    }

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.applyMembershipMetadataJsonbPatch(manager, {
        membershipId: membership.id,
        tenantId,
        patch: metadataPatch,
        removeKeys: metadataRemoveKeys
      });
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
      await this.access.findTenantScopedUserOrThrow(userId),
    );
  }

  async updateUserRole(userId: string, role: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);
    const newRoleValue = tryParseWorkspaceUserRole(role);
    if (!newRoleValue) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ENUM_INVALID",
          message: "Unknown or unsupported workspace role"
        }
      });
    }

    const membership = await this.access.findMembership(tenantId, userId);
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
        await this.access.findTenantScopedUserOrThrow(userId)
      );
    }

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.updateMembershipRoleWithSessionBump(
        manager,
        tenantId,
        membership.id,
        newRoleValue
      );
      await this.identityRepository.insertUserRoleAuditEntry(manager, {
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
      await this.access.findTenantScopedUserOrThrow(userId)
    );
  }

  async bulkUpdateUserRole(userIds: string[], role: string): Promise<UserResponseDto[]> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);
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

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;
    const clientIp = this.requestContextService.tryGetClientIp();
    const requestId = this.requestContextService.tryGetRequestId();

    return this.identityRepository.runInTransaction(async (manager) => {
      const memberships = await this.identityRepository.findActiveMembershipsByUserIdsInTransaction(
        manager,
        tenantId,
        normalizedUserIds
      );
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
        await this.identityRepository.bulkUpdateMembershipRoles(
          manager,
          tenantId,
          changedMemberships.map((m) => m.id),
          newRoleValue
        );

        await this.identityRepository.insertUserRoleAuditEntries(
          manager,
          changedMemberships.map((membership) => ({
            tenantId,
            actorUserId,
            targetUserId: membership.userId,
            oldRole: membership.role,
            newRole: newRoleValue
          }))
        );

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

      const users = await this.identityRepository.loadBulkUserMembershipSummaryRows(
        manager,
        tenantId,
        normalizedUserIds
      );
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
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    if (actorUserId.trim() === userId.trim()) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_SELF_SUSPEND_FORBIDDEN",
          message: "You cannot suspend your own membership"
        }
      });
    }

    const membership = await this.access.findMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    if (isProtectedWorkspaceOwnerMembership(membership)) {
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
      const actorLabelRecord = await this.access.findUserById(actorUserId);
      const actorLabel = actorLabelRecord?.email ?? actorUserId;
      await this.access.updateMembership(
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
      await this.access.findTenantScopedUserOrThrow(userId)
    );
  }

  async reactivateUserMembership(userId: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const membership = await this.access.findMembership(tenantId, userId);
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
    await this.access.updateMembership(
      { id: membership.id, deletedAt: IsNull() },
      {
        status: MembershipStatus.ACTIVE,
        suspendedAt: null
      }
    );
    const actorLabelRecord = await this.access.findUserById(actorUserId);
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
      await this.access.findTenantScopedUserOrThrow(userId)
    );
  }

  async removeUserMembership(userId: string): Promise<void> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    if (actorUserId.trim() === userId.trim()) {
      throw new ForbiddenException({
        error: {
          code: "RBAC_SELF_REMOVE_FORBIDDEN",
          message: "You cannot remove your own membership"
        }
      });
    }

    const membership = await this.access.findMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    if (isProtectedWorkspaceOwnerMembership(membership)) {
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

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.deleteMembershipHard(manager, membership.id);

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

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    return this.identityRepository.runInTransaction(async (manager) => {
      const actorMembership = await this.identityRepository.findActiveMembershipForUpdateLocking(
        manager,
        tenantId,
        actorUserId
      );
      if (!actorMembership || !isWorkspaceOwner(actorMembership)) {
        throw new ForbiddenException({
          error: {
            code: "OWNER_ONLY_TRANSFER",
            message: "Only the current workspace owner can transfer ownership."
          }
        });
      }

      const targetMembership = await this.identityRepository.findActiveMembershipForUpdateLocking(
        manager,
        tenantId,
        newOwnerUserId
      );
      if (!targetMembership) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      await this.identityRepository.executeWorkspaceOwnershipTransfer(manager, {
        tenantId,
        actorUserId,
        newOwnerUserId,
        actorMembershipId: actorMembership.id,
        targetMembershipId: targetMembership.id,
        actorPriorRole: actorMembership.role,
        targetPriorRole: targetMembership.role
      });

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
