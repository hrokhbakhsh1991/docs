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
import type { UserBookingSummaryResponseDto } from "./dto/user-booking-summary-response.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { UsersAccessService } from "./users-access.service";
import { applyMembershipMetadataJsonbPatch } from "./membership-metadata-jsonb";
import { WorkspaceUserBookingSummaryService } from "./workspace-user-booking-summary.service";

@Injectable()
export class WorkspaceUsersService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @Inject(WorkspaceUserBookingSummaryService)
    private readonly bookingSummaries: WorkspaceUserBookingSummaryService,
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
    const metadataPatch: Record<string, unknown> = {};
    const metadataRemoveKeys: string[] = [];
    if (normalizedDiscount !== undefined) {
      metadataPatch.permanentDiscountPercentage = normalizedDiscount;
    }
    if (normalizedBadges !== undefined) {
      if (normalizedBadges.length > 0) {
        metadataPatch.badges = normalizedBadges;
      } else {
        metadataRemoveKeys.push("badges");
      }
    }
    if (payload.isSelectableLeader !== undefined) {
      metadataPatch.capabilities = setSelectableLeaderCapability(
        existingMeta.capabilities,
        payload.isSelectableLeader
      );
    }

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await applyMembershipMetadataJsonbPatch(manager, {
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
          action: TenantAuditAction.MEMBERSHIP_REWARDS_CHANGED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: {
            permanent_discount_percentage:
              normalizedDiscount ?? existingMeta.permanentDiscountPercentage,
            badges: normalizedBadges ?? existingMeta.badges ?? [],
            selectable_leader:
              payload.isSelectableLeader ?? membershipHasSelectableLeader(existingMeta)
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

    const actorLabelRecord = await this.access.users.findOne({
      where: { id: actorUserId, deletedAt: IsNull() }
    });
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.dataSource.transaction(async (manager) => {
      await applyMembershipMetadataJsonbPatch(manager, {
        membershipId: membership.id,
        tenantId,
        patch: { capabilities: nextCapabilities }
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

  async getUserBookingSummary(userId: string): Promise<UserBookingSummaryResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);
    await this.access.findTenantScopedUserOrThrow(tenantId, userId);
    const map = await this.bookingSummaries.loadBookingSummariesForUserIds(tenantId, [userId]);
    return map.get(userId) ?? { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };
  }
}
