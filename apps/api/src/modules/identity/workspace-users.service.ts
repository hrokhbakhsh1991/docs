import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  membershipHasSelectableLeader,
  parseMembershipMetadata,
  setSelectableLeaderCapability,
  WORKSPACE_REWARD_BADGE_IDS,
  type WorkspaceRewardBadgeId
} from "@repo/shared";
import { DataSource, IsNull } from "typeorm";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { UserRole, tryParseWorkspaceUserRole } from "../../common/auth/user-role.enum";
import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  evaluateGeneralMembershipRoleChange
} from "../../common/rbac/workspace-membership-rbac.policy";
import { tenantScopedResourceNotFoundError } from "../../common/errors/error-response-builders";
import type { PostToggleSelectableLeaderDto } from "./dto/post-toggle-selectable-leader.dto";
import type { PostWorkspaceUserRewardsDto } from "./dto/post-workspace-user-rewards.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { UsersAccessService } from "./users-access.service";

function mergeMembershipRewardsMetadata(
  existing: Record<string, unknown> | null | undefined,
  input: {
    permanentDiscountPercentage?: number;
    badges?: WorkspaceRewardBadgeId[];
  }
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  const next: Record<string, unknown> = { ...base };
  if (input.permanentDiscountPercentage !== undefined) {
    next.permanentDiscountPercentage = input.permanentDiscountPercentage;
  }
  if (input.badges !== undefined) {
    if (input.badges.length > 0) {
      next.badges = input.badges;
    } else {
      delete next.badges;
    }
  }
  return next;
}

@Injectable()
export class WorkspaceUsersService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService
  ) {}

  async patchUserRole(userId: string, role: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    if (actorRole !== UserRole.Owner) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ROLE",
          message: "Only workspace owners may change roles via this endpoint"
        }
      });
    }
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
            patch_scope: "workspace_owner_role"
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

  async postUserRewards(userId: string, payload: PostWorkspaceUserRewardsDto): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    if (
      payload.permanentDiscountPercentage === undefined &&
      payload.badges === undefined &&
      payload.isSelectableLeader === undefined
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "At least one of permanentDiscountPercentage, badges, or isSelectableLeader is required"
        }
      });
    }

    let normalizedDiscount: number | undefined;
    if (payload.permanentDiscountPercentage !== undefined) {
      const raw = payload.permanentDiscountPercentage;
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 100) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_ERROR",
            message: "permanentDiscountPercentage must be an integer between 0 and 100"
          }
        });
      }
      normalizedDiscount = raw;
    }

    const normalizedBadges =
      payload.badges === undefined
        ? undefined
        : payload.badges
            .map((b) => b.trim().toUpperCase())
            .filter((b): b is WorkspaceRewardBadgeId =>
              (WORKSPACE_REWARD_BADGE_IDS as readonly string[]).includes(b)
            );

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const existingMeta = parseMembershipMetadata(membership.membershipMetadata);
    let nextMetadata = mergeMembershipRewardsMetadata(membership.membershipMetadata, {
      permanentDiscountPercentage: normalizedDiscount,
      badges: normalizedBadges
    });
    if (payload.isSelectableLeader !== undefined) {
      const nextCapabilities = setSelectableLeaderCapability(
        existingMeta.capabilities,
        payload.isSelectableLeader
      );
      nextMetadata = {
        ...nextMetadata,
        capabilities: nextCapabilities
      };
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_tenants SET membership_metadata = $1::jsonb, session_version = session_version + 1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [JSON.stringify(nextMetadata), membership.id, tenantId]
      );
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.MEMBERSHIP_REWARDS_CHANGED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: {
            permanent_discount_percentage:
              normalizedDiscount ?? parseMembershipMetadata(nextMetadata).permanentDiscountPercentage,
            badges: normalizedBadges ?? parseMembershipMetadata(nextMetadata).badges ?? [],
            selectable_leader:
              payload.isSelectableLeader ??
              membershipHasSelectableLeader(parseMembershipMetadata(nextMetadata))
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

  async toggleSelectableLeader(
    userId: string,
    payload: PostToggleSelectableLeaderDto
  ): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const existingMeta = parseMembershipMetadata(membership.membershipMetadata);
    const nextCapabilities = setSelectableLeaderCapability(
      existingMeta.capabilities,
      payload.enabled
    );
    const nextMetadata: Record<string, unknown> = {
      ...(membership.membershipMetadata &&
      typeof membership.membershipMetadata === "object" &&
      !Array.isArray(membership.membershipMetadata)
        ? { ...membership.membershipMetadata }
        : {}),
      capabilities: nextCapabilities
    };

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE user_tenants SET membership_metadata = $1::jsonb, session_version = session_version + 1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [JSON.stringify(nextMetadata), membership.id, tenantId]
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
            selectable_leader: payload.enabled,
            capabilities: nextCapabilities
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
}
