import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import {
  authRequiredError,
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { UserResponseDto } from "./dto/user-response.dto";
import { MembershipStatus } from "./membership-status.enum";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserEntity } from "./entities/user.entity";

export type TenantScopedUserRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  role: string;
  membership_status: MembershipStatus;
  last_login_at?: Date | null;
  invited_at?: Date | null;
  joined_at?: Date | null;
  suspended_at?: Date | null;
};

@Injectable()
export class UsersAccessService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    private readonly requestContextService: RequestContextService
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

  resolveActorContextOrThrow(): { actorUserId: string; actorRole: string | undefined } {
    const actorUserId = this.requestContextService.getUserId();
    const actorRole = this.requestContextService.getRole();
    if (!actorUserId) {
      throw new ForbiddenException(authRequiredError());
    }
    return { actorUserId, actorRole };
  }

  async ensureActorMembershipOrThrow(tenantId: string, actorUserId: string): Promise<void> {
    const actorMembership = await this.userTenantRepository.findOne({
      where: { tenantId, userId: actorUserId, deletedAt: IsNull() }
    });
    if (!actorMembership) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied"
        }
      });
    }
  }

  async findTenantScopedUserOrThrow(
    tenantId: string,
    userId: string
  ): Promise<TenantScopedUserRow> {
    const row = await this.userRepository
      .createQueryBuilder("u")
      .innerJoin(
        UserTenantEntity,
        "ut",
        "ut.user_id = u.id AND ut.tenant_id = :tenantId AND ut.deleted_at IS NULL",
        { tenantId }
      )
      .where("u.id = :userId", { userId })
      .andWhere("u.deleted_at IS NULL")
      .select([
        "u.id AS id",
        "u.full_name AS full_name",
        "u.email AS email",
        "u.phone AS phone",
        "u.last_login_at AS last_login_at",
        "u.is_email_verified AS is_email_verified",
        "u.is_phone_verified AS is_phone_verified",
        "ut.role AS role",
        "ut.membership_status AS membership_status",
        "ut.invited_at AS invited_at",
        "ut.joined_at AS joined_at",
        "ut.suspended_at AS suspended_at"
      ])
      .getRawOne<TenantScopedUserRow>();
    if (!row) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return row;
  }

  toUserResponseDto(row: TenantScopedUserRow): UserResponseDto {
    return {
      id: row.id,
      name: row.full_name?.trim() || row.email.split("@")[0] || "User",
      email: row.email,
      phone: row.phone,
      isPhoneVerified: row.is_phone_verified,
      role: row.role,
      status: row.membership_status,
      lastLoginAt: row.last_login_at ?? null,
      invitedAt: row.invited_at ?? null,
      joinedAt: row.joined_at ?? null,
      suspendedAt: row.suspended_at ?? null
    };
  }
}
