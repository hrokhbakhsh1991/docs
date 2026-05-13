import { Injectable } from "@nestjs/common";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { ListUsersResponseDto } from "./dto/list-users-response.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import { MembershipStatus } from "./membership-status.enum";
import { UsersAccessService } from "./users-access.service";

@Injectable()
export class UsersReadService {
  constructor(private readonly access: UsersAccessService) {}

  async listUsers(query: ListUsersQueryDto): Promise<ListUsersResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();

    const limit = query.limit ?? 50;
    const normalizedSearch = query.search?.trim().toLowerCase() ?? "";
    const roleFilter = query.role?.trim().toLowerCase();
    const statusFilter = query.status?.trim().toUpperCase();
    const lastLoginFrom = query.lastLoginFrom?.trim();
    const lastLoginTo = query.lastLoginTo?.trim();
    const decodedCursor = this.decodeUsersCursor(query.cursor);

    const qb = this.access.users
      .createQueryBuilder("u")
      .innerJoin(
        UserTenantEntity,
        "ut",
        "ut.user_id = u.id AND ut.tenant_id = :tenantId AND ut.deleted_at IS NULL",
        { tenantId }
      )
      .where("u.deleted_at IS NULL");

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

    if (decodedCursor) {
      qb.andWhere(
        "(ut.created_at < :cursorCreatedAt OR (ut.created_at = :cursorCreatedAt AND ut.id < :cursorId))",
        {
          cursorCreatedAt: decodedCursor.createdAt,
          cursorId: decodedCursor.id
        }
      );
    }

    const rows = await qb
      .select([
        "u.id AS id",
        "u.full_name AS full_name",
        "u.email AS email",
        "u.phone AS phone",
        "u.last_login_at AS last_login_at",
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
        "u.profile_row_version AS profile_row_version",
        "(u.telegram_user_id IS NOT NULL AND btrim(u.telegram_user_id) <> '') AS telegram_linked"
      ])
      .orderBy("ut.created_at", "DESC")
      .addOrderBy("ut.id", "DESC")
      .limit(limit + 1)
      .getRawMany<{
        id: string;
        full_name: string | null;
        email: string;
        phone: string | null;
        last_login_at: Date | null;
        is_email_verified: boolean;
        is_phone_verified: boolean;
        membership_id: string;
        membership_created_at: Date;
        role: string;
        membership_status: MembershipStatus;
        invited_at: Date | null;
        joined_at: Date | null;
        suspended_at: Date | null;
        labels: unknown;
        telegram_linked: boolean | string;
        profile_row_version: number | null;
      }>();

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    const data: UserResponseDto[] = pageRows.map((row) =>
      this.access.toUserResponseDto({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        last_login_at: row.last_login_at,
        is_email_verified: row.is_email_verified,
        is_phone_verified: row.is_phone_verified,
        role: row.role,
        membership_status: row.membership_status,
        invited_at: row.invited_at,
        joined_at: row.joined_at,
        suspended_at: row.suspended_at,
        labels: row.labels,
        telegram_linked: row.telegram_linked,
        profile_row_version: row.profile_row_version ?? undefined
      })
    );

    const last = pageRows.at(-1);
    const nextCursor =
      hasNext && last
        ? this.encodeUsersCursor({
            createdAt: new Date(last.membership_created_at).toISOString(),
            id: last.membership_id
          })
        : null;

    return { data, nextCursor };
  }

  async getUserById(userId: string): Promise<UserResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();
    const { actorUserId } = this.access.resolveActorContextOrThrow();
    await this.access.ensureActorMembershipOrThrow(tenantId, actorUserId);
    const user = await this.access.findTenantScopedUserOrThrow(tenantId, userId);
    return this.access.toUserResponseDto(user);
  }

  private encodeUsersCursor(input: { createdAt: string; id: string }): string {
    return Buffer.from(JSON.stringify(input)).toString("base64url");
  }

  private decodeUsersCursor(
    rawCursor: string | undefined
  ): { createdAt: string; id: string } | null {
    if (!rawCursor || rawCursor.trim() === "") {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as {
        createdAt?: unknown;
        id?: unknown;
      };
      if (typeof decoded.createdAt !== "string" || typeof decoded.id !== "string") {
        return null;
      }
      const createdAt = decoded.createdAt.trim();
      const id = decoded.id.trim();
      if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
        return null;
      }
      return { createdAt, id };
    } catch {
      return null;
    }
  }
}
