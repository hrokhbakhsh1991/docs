import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  UserRole,
  tryParseWorkspaceUserRole,
  type RequestActorRole
} from "../../common/auth/user-role.enum";
import { FALLBACK_OPERATING_CURRENCY_CODE } from "./users-member-wallet-balances.service";
import {
  authRequiredError,
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { normalizeMembershipLabels } from "../../common/rbac/normalize-membership-labels";
import { membershipHasSelectableLeader, parseMembershipMetadata } from "@repo/shared";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { UserResponseDto } from "./dto/user-response.dto";
import { PROFILE_GENDER_VALUES, type ProfileGenderValue } from "./constants/profile-gender";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserEntity } from "./entities/user.entity";
import type { TenantScopedUserRow } from "./users/users-tenant-scope.types";
import { UsersTenantScopeRepository } from "./users/repositories/users-tenant-scope.repository";
import type { MemberWalletBalanceSnapshot } from "./users-member-wallet-balances.service";
import type { UserBookingSummarySnapshot } from "./workspace-user-booking-summary.service";

export type { TenantScopedUserRow } from "./users/users-tenant-scope.types";

export type UserResponseMappingContext = {
  wallet?: MemberWalletBalanceSnapshot;
  bookingSummary?: UserBookingSummarySnapshot;
};

/**
 * **Services = orchestration + policy** (tenant resolution, guards, DTO mapping).
 * Tenant-scoped row loads delegate to repositories (**persistence only**).
 */
@Injectable()
export class UsersAccessService {
  private readonly logger = new Logger(UsersAccessService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(UsersTenantScopeRepository)
    private readonly tenantScopeRepository: UsersTenantScopeRepository
  ) {}

  get users(): Repository<UserEntity> {
    return this.userRepository;
  }

  get memberships(): Repository<UserTenantEntity> {
    return this.userTenantRepository;
  }

  resolveTenantIdOrThrow(): string {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    return tenantId;
  }

  resolveActorContextOrThrow(): { actorUserId: string; actorRole: RequestActorRole | undefined } {
    const actorUserId = this.requestContextService.getUserId();
    const actorRole = this.requestContextService.getRole();
    if (!actorUserId) {
      throw new ForbiddenException(authRequiredError());
    }
    return { actorUserId, actorRole };
  }

  async ensureActorMembershipOrThrow(tenantId: string, actorUserId: string): Promise<void> {
    const actorMembership = await this.tenantScopeRepository.findActiveMembership(tenantId, actorUserId);
    if (!actorMembership) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied"
        }
      });
    }
  }

  async findTenantScopedUserOrThrow(tenantId: string, userId: string): Promise<TenantScopedUserRow> {
    const row = await this.tenantScopeRepository.findTenantScopedUserRow(tenantId, userId);
    if (!row) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return row;
  }

  toUserResponseDto(row: TenantScopedUserRow, ctx?: UserResponseMappingContext): UserResponseDto {
    let membershipRole = tryParseWorkspaceUserRole(row.role);
    if (!membershipRole) {
      this.logger.warn(
        `Unknown membership role "${String(row.role ?? "")}" for user ${row.id}; falling back to ${UserRole.Member}`
      );
      membershipRole = UserRole.Member;
    }
    const meta = parseMembershipMetadata(row.membership_metadata);
    const wallet = ctx?.wallet;
    const booking = ctx?.bookingSummary;

    return {
      id: row.id,
      name:
        row.full_name?.trim() ||
        row.email?.split("@")[0]?.trim() ||
        row.phone?.trim() ||
        "User",
      email: row.email ?? null,
      phone: row.phone,
      isPhoneVerified: row.is_phone_verified,
      role: membershipRole,
      status: row.membership_status,
      gender: normalizeProfileGender(row.gender),
      profileImageUrl: normalizeProfileImageUrl(row.profile_image_url),
      lastLoginAt: row.last_login_at ?? null,
      lastActiveAt: row.last_active_at ?? null,
      invitedAt: row.invited_at ?? null,
      joinedAt: row.joined_at ?? null,
      suspendedAt: row.suspended_at ?? null,
      labels: normalizeMembershipLabels(row.labels),
      permanentDiscountPercentage: meta.permanentDiscountPercentage,
      rewardBadges: meta.badges ?? [],
      isSelectableLeader: membershipHasSelectableLeader(meta),
      telegramLinked: coerceTelegramLinked(row.telegram_linked),
      walletBalanceMinor: wallet?.balanceMinor ?? "0",
      walletCurrency: wallet?.currency ?? FALLBACK_OPERATING_CURRENCY_CODE,
      totalTrips: booking?.totalTrips ?? 0,
      completedTrips: booking?.completedTrips ?? 0,
      cancelledTrips: booking?.cancelledTrips ?? 0,
      profileRowVersion:
        row.profile_row_version !== undefined && row.profile_row_version !== null
          ? Number(row.profile_row_version)
          : undefined
    };
  }
}

function normalizeProfileGender(value: string | null | undefined): ProfileGenderValue | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if ((PROFILE_GENDER_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as ProfileGenderValue;
  }
  return null;
}

function normalizeProfileImageUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceTelegramLinked(value: boolean | string | null | undefined): boolean {
  if (value === true || value === "t" || value === "true" || value === "1") {
    return true;
  }
  return false;
}
