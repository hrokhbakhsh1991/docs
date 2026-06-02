import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  membershipHasSelectableLeader,
  parseMembershipMetadata,
  setSelectableLeaderCapability,
  WORKSPACE_REWARD_BADGE_IDS,
  type WorkspaceRewardBadgeId
} from "@repo/shared";
import { normalizeMembershipLabels } from "../../common/rbac/normalize-membership-labels";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { tryParseWorkspaceUserRole } from "../../common/auth/user-role.enum";
import { isWorkspaceOwner } from "../../common/rbac/workspace-access.helper";
import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  evaluateGeneralMembershipRoleChange
} from "../../common/rbac/workspace-membership-rbac.policy";
import { tenantScopedResourceNotFoundError } from "../../common/errors/error-response-builders";
import type { PostToggleSelectableLeaderDto } from "./dto/post-toggle-selectable-leader.dto";
import type { PostWorkspaceUserRewardsDto } from "./dto/post-workspace-user-rewards.dto";
import type { UserBookingSummaryResponseDto } from "./dto/user-booking-summary-response.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort
} from "./domain/ports/workspace-identity-repository.port";
import { UsersAccessService } from "./users-access.service";
import { readRawCapabilityTokens } from "./membership-raw-capabilities";
import { UsersMemberWalletBalancesService } from "./users-member-wallet-balances.service";
import { WorkspaceUserBookingSummaryService } from "./workspace-user-booking-summary.service";

@Injectable()
export class WorkspaceUsersService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @Inject(WorkspaceUserBookingSummaryService)
    private readonly bookingSummaries: WorkspaceUserBookingSummaryService,
    @Inject(UsersMemberWalletBalancesService)
    private readonly memberWalletBalances: UsersMemberWalletBalancesService,
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService
  ) {}

  private async toEnrichedUserResponse(tenantId: string, userId: string): Promise<UserResponseDto> {
    const row = await this.access.findTenantScopedUserOrThrow(userId);
    const [walletMap, bookingMap] = await Promise.all([
      this.memberWalletBalances.loadBalancesForUserIds(tenantId, [userId]),
      this.bookingSummaries.loadBookingSummariesForUserIds(tenantId, [userId])
    ]);
    return this.access.toUserResponseDto(row, {
      wallet: walletMap.get(userId),
      bookingSummary: bookingMap.get(userId)
    });
  }

  async patchUserRole(userId: string, role: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId, actorRole } = this.access.resolveActorContextOrThrow();
    if (!isWorkspaceOwner(actorRole)) {
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ROLE",
          message: "Only workspace owners may change roles via this endpoint"
        }
      });
    }
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
            patch_scope: "workspace_owner_role"
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

  async postUserRewards(userId: string, payload: PostWorkspaceUserRewardsDto): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    if (
      payload.permanentDiscountPercentage === undefined &&
      payload.badges === undefined &&
      payload.isSelectableLeader === undefined &&
      payload.labels === undefined
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "At least one of permanentDiscountPercentage, badges, isSelectableLeader, or labels is required"
        }
      });
    }

    let normalizedDiscount: number | undefined;
    let clearPermanentDiscount = false;
    if (payload.permanentDiscountPercentage === null) {
      clearPermanentDiscount = true;
    } else if (payload.permanentDiscountPercentage !== undefined) {
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

    const membership = await this.access.findMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const existingMeta = parseMembershipMetadata(membership.membershipMetadata);
    const metadataPatch: Record<string, unknown> = {};
    const metadataRemoveKeys: string[] = [];
    if (clearPermanentDiscount) {
      metadataRemoveKeys.push("permanentDiscountPercentage");
    } else if (normalizedDiscount !== undefined) {
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
        readRawCapabilityTokens(membership.membershipMetadata),
        payload.isSelectableLeader
      );
    }

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const normalizedLabels =
      payload.labels === undefined ? undefined : normalizeMembershipLabels(payload.labels);

    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.applyMembershipMetadataJsonbPatch(manager, {
        membershipId: membership.id,
        tenantId,
        patch: metadataPatch,
        removeKeys: metadataRemoveKeys
      });
      if (normalizedLabels !== undefined) {
        await this.identityRepository.updateMembershipLabels(
          manager,
          membership.id,
          tenantId,
          normalizedLabels
        );
      }
      const auditMetadata: Record<string, unknown> = {
        permanent_discount_percentage:
          normalizedDiscount ?? existingMeta.permanentDiscountPercentage,
        badges: normalizedBadges ?? existingMeta.badges ?? [],
        selectable_leader:
          payload.isSelectableLeader ?? membershipHasSelectableLeader(existingMeta)
      };
      if (normalizedLabels !== undefined) {
        auditMetadata.labels = normalizedLabels;
      }
      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId,
          actor: actorLabel,
          userId,
          action: TenantAuditAction.MEMBERSHIP_REWARDS_CHANGED,
          resourceType: "user_membership",
          resourceId: membership.id,
          metadata: auditMetadata,
          clientIp: this.requestContextService.tryGetClientIp(),
          requestId: this.requestContextService.tryGetRequestId()
        },
        manager
      );
    });

    return this.toEnrichedUserResponse(tenantId, userId);
  }

  async toggleSelectableLeader(
    userId: string,
    payload: PostToggleSelectableLeaderDto
  ): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);

    const membership = await this.access.findMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const nextCapabilities = setSelectableLeaderCapability(
      readRawCapabilityTokens(membership.membershipMetadata),
      payload.enabled
    );

    const actorLabelRecord = await this.access.findUserById(actorUserId);
    const actorLabel = actorLabelRecord?.email ?? actorUserId;

    await this.identityRepository.runInTransaction(async (manager) => {
      await this.identityRepository.applyMembershipMetadataJsonbPatch(manager, {
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

    return this.toEnrichedUserResponse(tenantId, userId);
  }

  async getUserBookingSummary(userId: string): Promise<UserBookingSummaryResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(actorUserId);
    await this.access.findTenantScopedUserOrThrow(userId);
    const map = await this.bookingSummaries.loadBookingSummariesForUserIds(tenantId, [userId]);
    const counts = map.get(userId) ?? { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };
    const trips = await this.bookingSummaries.loadBookingTripsForUser(tenantId, userId);
    return { ...counts, trips };
  }
}
