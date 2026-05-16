import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { UserTenantEntity } from "../../entities/user-tenant.entity";
import { UserEntity } from "../../entities/user.entity";
import type { TenantScopedUserRow } from "../users-tenant-scope.types";
import type { IUsersTenantScopeRepository } from "./users-tenant-scope.repository.interface";

@Injectable()
export class UsersTenantScopeRepository implements IUsersTenantScopeRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>
  ) {}

  async findTenantScopedUserRow(tenantId: string, userId: string): Promise<TenantScopedUserRow | null> {
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
        "ut.suspended_at AS suspended_at",
        "ut.labels AS labels",
        "ut.membership_metadata AS membership_metadata",
        "u.profile_row_version AS profile_row_version",
        "(u.telegram_user_id IS NOT NULL AND btrim(u.telegram_user_id) <> '') AS telegram_linked"
      ])
      .getRawOne<TenantScopedUserRow>();
    return row ?? null;
  }

  findActiveMembership(tenantId: string, userId: string): Promise<UserTenantEntity | null> {
    return this.userTenantRepository.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
  }
}
