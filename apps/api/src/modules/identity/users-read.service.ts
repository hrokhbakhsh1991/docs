import { Inject, Injectable } from "@nestjs/common";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { ListUsersResponseDto } from "./dto/list-users-response.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import { UsersListRepository } from "./users/repositories/users-list.repository";
import { UsersAccessService } from "./users-access.service";
import { UsersMemberWalletBalancesService } from "./users-member-wallet-balances.service";
import { WorkspaceUserBookingSummaryService } from "./workspace-user-booking-summary.service";

/**
 * **Services = orchestration + policy** (cursors, list shaping). Listing queries delegate to repositories (**persistence only**).
 */
@Injectable()
export class UsersReadService {
  constructor(
    @Inject(UsersAccessService) private readonly access: UsersAccessService,
    @Inject(UsersListRepository) private readonly usersListRepository: UsersListRepository,
    @Inject(UsersMemberWalletBalancesService)
    private readonly memberWalletBalances: UsersMemberWalletBalancesService,
    @Inject(WorkspaceUserBookingSummaryService)
    private readonly bookingSummaries: WorkspaceUserBookingSummaryService
  ) {}

  async listUsers(query: ListUsersQueryDto): Promise<ListUsersResponseDto> {
    const tenantId = this.access.resolveTenantIdOrThrow();

    const limit = query.limit ?? 50;
    const normalizedSearch = query.search?.trim().toLowerCase() ?? "";
    const roleFilter = query.role?.trim().toLowerCase();
    const statusFilter = query.status?.trim().toUpperCase();
    const lastLoginFrom = query.lastLoginFrom?.trim();
    const lastLoginTo = query.lastLoginTo?.trim();
    const decodedCursor = this.decodeUsersCursor(query.cursor, tenantId);

    const rows = await this.usersListRepository.listTenantUsers({
      tenantId,
      limit,
      normalizedSearch,
      roleFilter: roleFilter || undefined,
      statusFilter: statusFilter || undefined,
      lastLoginFrom: lastLoginFrom || undefined,
      lastLoginTo: lastLoginTo || undefined,
      cursor: decodedCursor
    });

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    const pageUserIds = pageRows.map((row) => row.id);
    const [walletByUserId, bookingByUserId] = await Promise.all([
      this.memberWalletBalances.loadBalancesForUserIds(tenantId, pageUserIds),
      this.bookingSummaries.loadBookingSummariesForUserIds(tenantId, pageUserIds)
    ]);

    const data: UserResponseDto[] = pageRows.map((row) =>
      this.access.toUserResponseDto(
        {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          profile_image_url: row.profile_image_url,
          last_login_at: row.last_login_at,
          last_active_at: row.last_active_at,
          is_email_verified: row.is_email_verified,
          is_phone_verified: row.is_phone_verified,
          role: row.role,
          membership_status: row.membership_status,
          invited_at: row.invited_at,
          joined_at: row.joined_at,
          suspended_at: row.suspended_at,
          labels: row.labels,
          membership_metadata: row.membership_metadata,
          telegram_linked: row.telegram_linked,
          profile_row_version: row.profile_row_version ?? undefined
        },
        {
          wallet: walletByUserId.get(row.id),
          bookingSummary: bookingByUserId.get(row.id)
        }
      )
    );

    const last = pageRows.at(-1);
    const nextCursor =
      hasNext && last
        ? this.encodeUsersCursor({
            tenantId,
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
    const [walletMap, bookingMap] = await Promise.all([
      this.memberWalletBalances.loadBalancesForUserIds(tenantId, [userId]),
      this.bookingSummaries.loadBookingSummariesForUserIds(tenantId, [userId])
    ]);
    return this.access.toUserResponseDto(user, {
      wallet: walletMap.get(userId),
      bookingSummary: bookingMap.get(userId)
    });
  }

  private encodeUsersCursor(input: { tenantId: string; createdAt: string; id: string }): string {
    return Buffer.from(
      JSON.stringify({ v: 1, t: input.tenantId, c: input.createdAt, i: input.id })
    ).toString("base64url");
  }

  private decodeUsersCursor(
    rawCursor: string | undefined,
    tenantId: string
  ): { createdAt: string; id: string } | null {
    if (!rawCursor || rawCursor.trim() === "") {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as {
        v?: unknown;
        t?: unknown;
        c?: unknown;
        i?: unknown;
        createdAt?: unknown;
        id?: unknown;
      };
      if (decoded.v === 1 && typeof decoded.t === "string" && typeof decoded.c === "string" && typeof decoded.i === "string") {
        if (decoded.t !== tenantId) {
          return null;
        }
        const createdAt = decoded.c.trim();
        const id = decoded.i.trim();
        if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
          return null;
        }
        return { createdAt, id };
      }
      /** Legacy cursors lacked tenant binding — reject to avoid ambiguous pagination across workspaces. */
      if (typeof decoded.createdAt === "string" && typeof decoded.id === "string") {
        return null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
