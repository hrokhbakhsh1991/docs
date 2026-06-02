import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../entities/user.entity";
import { UserTenantEntity } from "../../entities/user-tenant.entity";
import type { IUsersListRepository, TenantUsersListQuery, TenantUsersListRow } from "./users-list.repository.interface";

/** @deprecated Logic moved to {@link TypeOrmIdentityRepository}; use {@link WORKSPACE_IDENTITY_REPOSITORY_PORT}. */
@Injectable()
export class UsersListRepository implements IUsersListRepository {
  constructor(
    @InjectRepository(UserTenantEntity)
    private readonly membershipRepository: Repository<UserTenantEntity>
  ) {}

  async listTenantUsers(query: TenantUsersListQuery): Promise<TenantUsersListRow[]> {
    const {
      tenantId,
      limit,
      normalizedSearch,
      roleFilter,
      statusFilter,
      lastLoginFrom,
      lastLoginTo,
      cursor
    } = query;

    const qb = this.membershipRepository
      .createQueryBuilder("ut")
      .innerJoin(UserEntity, "u", "u.id = ut.user_id AND u.deleted_at IS NULL")
      .where("ut.tenant_id = :tenantId", { tenantId })
      .andWhere("ut.deleted_at IS NULL");

    if (normalizedSearch.length > 0) {
      qb.andWhere(
        "(" +
          "LOWER(COALESCE(u.full_name, '')) LIKE :search OR " +
          "LOWER(u.email) LIKE :search OR " +
          "phone_normalized(COALESCE(u.phone, '')) LIKE phone_normalized(:searchRaw)" +
          ")",
        {
          search: `%${normalizedSearch}%`,
          searchRaw: `%${normalizedSearch}%`
        }
      );
    }
    if (roleFilter) {
      qb.andWhere("LOWER(ut.role) = :roleFilter", { roleFilter });
    }
    if (statusFilter) {
      qb.andWhere("ut.membership_status = :statusFilter", { statusFilter });
    }
    if (lastLoginFrom) {
      qb.andWhere("u.last_login_at >= :lastLoginFrom", { lastLoginFrom });
    }
    if (lastLoginTo) {
      qb.andWhere("u.last_login_at <= :lastLoginTo", { lastLoginTo });
    }

    if (cursor) {
      qb.andWhere(
        "(ut.created_at < :cursorCreatedAt OR (ut.created_at = :cursorCreatedAt AND ut.id < :cursorId))",
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id
        }
      );
    }

    return qb
      .select([
        "u.id AS id",
        "u.full_name AS full_name",
        "u.email AS email",
        "u.phone AS phone",
        "u.last_login_at AS last_login_at",
        "u.last_active_at AS last_active_at",
        "u.gender AS gender",
        "u.profile_image_url AS profile_image_url",
        "u.is_email_verified AS is_email_verified",
        "u.is_phone_verified AS is_phone_verified",
        "ut.id AS membership_id",
        "ut.role AS role",
        "ut.membership_status AS membership_status",
        "ut.invited_at AS invited_at",
        "ut.joined_at AS joined_at",
        "ut.suspended_at AS suspended_at",
        "ut.created_at AS membership_created_at",
        "ut.labels AS labels",
        "ut.membership_metadata AS membership_metadata",
        "u.profile_row_version AS profile_row_version",
        "(u.telegram_user_id IS NOT NULL AND btrim(u.telegram_user_id) <> '') AS telegram_linked"
      ])
      .orderBy("ut.created_at", "DESC")
      .addOrderBy("ut.id", "DESC")
      .limit(limit + 1)
      .getRawMany<TenantUsersListRow>();
  }
}
