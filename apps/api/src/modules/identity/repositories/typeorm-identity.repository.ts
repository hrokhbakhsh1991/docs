/**
 * TypeORM adapter for {@link WorkspaceIdentityRepositoryPort}.
 * Sole identity-module site for `@InjectRepository` / cross-entity identity reads.
 */
import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial, EntityManager, FindOptionsWhere, UpdateResult } from "typeorm";
import { Brackets, DataSource, In, IsNull, MoreThan, Repository } from "typeorm";

import { syntheticBookingContactPhone } from "../../../common/security/ownership-scope";
import { normalizeOtpPhoneInput } from "../../../common/phone/otp-phone-normalize";
import { memberWalletId } from "../../finance/ledger/member-wallet-id";
import { normalizeFinanceTenantId } from "../../finance/ledger/ledger-tenant-scope";
import { AccountBalanceEntity } from "../../finance/ledger/entities/account-balance.entity";
import { RegistrationEntity, RegistrationStatus } from "../../registrations/registration.entity";
import { TourDepartureEntity } from "../../tours/entities/tour-departure.entity";
import { TourProductEntity } from "../../tours/entities/tour-product.entity";
import { TourEntity } from "../../tours/entities/tour.entity";
import type { UserBookingTripRowDto } from "../dto/user-booking-trip-row.dto";
import { EmailVerificationTokenEntity } from "../entities/email-verification-token.entity";
import { TenantEntity } from "../entities/tenant.entity";
import { UserTenantEntity } from "../entities/user-tenant.entity";
import { UserEntity } from "../entities/user.entity";
import { UserRoleAuditEntity } from "../entities/user-role-audit.entity";
import {
  WorkspaceInviteEntity,
  WorkspaceInviteStatus
} from "../entities/workspace-invite.entity";
import { MembershipStatus } from "../membership-status.enum";
import { applyMembershipMetadataJsonbPatch } from "../membership-metadata-jsonb";
import { UserRole } from "../../../common/auth/user-role.enum";
import type {
  IdentityEmailVerificationTokenRecord,
  IdentityMembershipRecord,
  IdentityUserRecord,
  IdentityWorkspaceInviteRecord,
} from "../domain/identity-records";
import type {
  BulkUserMembershipSummaryRow,
  MemberWalletBalanceSnapshot,
  MembershipMetadataJsonbPatchInput,
  UserBookingSummarySnapshot,
  UserRoleAuditInsertRow,
  WorkspaceIdentityRepositoryPort,
  WorkspaceIdentityRoleHistoryRow,
  WorkspaceMemberListFilters,
  WorkspaceOwnershipTransferMutation
} from "../domain/ports/workspace-identity-repository.port";
import type {
  TenantUsersListQuery,
  TenantUsersListRow
} from "../users/repositories/users-list.repository.interface";
import type { TenantScopedUserRow } from "../users/users-tenant-scope.types";
import { normalizeOperatingCurrencyCode } from "../users-member-wallet-balances.service";

const CANCELLED_STATUSES = [RegistrationStatus.CANCELLED, RegistrationStatus.REJECTED];
const NON_COMPLETED_STATUSES = [
  RegistrationStatus.CANCELLED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.NO_SHOW
];
const TRIP_LIST_CAP = 50;

const asUser = (row: UserEntity | null): IdentityUserRecord | null => row;
const asMembership = (row: UserTenantEntity | null): IdentityMembershipRecord | null => row;
const asMembershipList = (rows: UserTenantEntity[]): IdentityMembershipRecord[] => rows;
const asInvite = (row: WorkspaceInviteEntity | null): IdentityWorkspaceInviteRecord | null => row;
const asInviteList = (rows: WorkspaceInviteEntity[]): IdentityWorkspaceInviteRecord[] => rows;
const asEmailToken = (
  row: EmailVerificationTokenEntity | null
): IdentityEmailVerificationTokenRecord | null => row;

type GroupedTripAggRow = {
  bridge_key: string;
  total_trips: string;
  cancelled_trips: string;
  completed_trips: string;
};

type TripRawRow = {
  tour_title: string;
  departure_on: string | Date | null;
  registration_status: string;
  payment_status: string;
};

function emptyBookingSummary(): UserBookingSummarySnapshot {
  return { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };
}

function parseCount(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mergeSummaries(
  target: UserBookingSummarySnapshot,
  addition: UserBookingSummarySnapshot
): UserBookingSummarySnapshot {
  return {
    totalTrips: target.totalTrips + addition.totalTrips,
    completedTrips: target.completedTrips + addition.completedTrips,
    cancelledTrips: target.cancelledTrips + addition.cancelledTrips
  };
}

function formatDepartureDate(value: string | Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (s.length === 0) {
    return null;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

@Injectable()
export class TypeOrmIdentityRepository implements WorkspaceIdentityRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly membershipRepository: Repository<UserTenantEntity>,
    @InjectRepository(WorkspaceInviteEntity)
    private readonly workspaceInviteRepository: Repository<WorkspaceInviteEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(AccountBalanceEntity)
    private readonly accountBalanceRepository: Repository<AccountBalanceEntity>,
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  private userRepo(manager?: EntityManager): Repository<UserEntity> {
    return manager ? manager.getRepository(UserEntity) : this.userRepository;
  }

  async findUserById(userId: string, manager?: EntityManager): Promise<IdentityUserRecord | null> {
    return asUser(
      await this.userRepo(manager).findOne({
        where: { id: userId, deletedAt: IsNull() }
      })
    );
  }

  findActiveTenantById(
    tenantId: string
  ): Promise<Pick<TenantEntity, "id" | "enabledModules"> | null> {
    return this.tenantRepository.findOne({
      where: { id: tenantId, deletedAt: IsNull() },
      select: { id: true, enabledModules: true }
    });
  }

  async updateTenantEnabledModules(
    tenantId: string,
    enabledModules: readonly string[]
  ): Promise<string[]> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId, deletedAt: IsNull() }
    });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    tenant.enabledModules = [...enabledModules];
    const saved = await this.tenantRepository.save(tenant);
    return [...(saved.enabledModules ?? [])];
  }

  async findUserByEmail(email: string): Promise<IdentityUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return asUser(
      await this.userRepository.findOne({
        where: { email: normalized, deletedAt: IsNull() }
      })
    );
  }

  async findActiveUserByEmailCaseInsensitive(
    email: string,
    manager?: EntityManager
  ): Promise<IdentityUserRecord | null> {
    const trimmed = email.trim();
    if (trimmed === "") {
      return null;
    }
    return asUser(
      await this.userRepo(manager)
        // tenant-isolation:qb-exempt — global users.email lookup for auth (not tenant-scoped)
        .createQueryBuilder("u")
        .where("LOWER(TRIM(u.email)) = LOWER(TRIM(:email))", { email: trimmed })
        .andWhere("u.deleted_at IS NULL")
        .getOne()
    );
  }

  async findUserByEmailExact(
    email: string,
    manager?: EntityManager
  ): Promise<IdentityUserRecord | null> {
    return asUser(
      await this.userRepo(manager).findOne({
        where: { email, deletedAt: IsNull() }
      })
    );
  }

  async findUserByNationalIdActive(nationalId: string): Promise<IdentityUserRecord | null> {
    return asUser(
      await this.userRepository.findOne({
        where: { nationalId, deletedAt: IsNull() }
      })
    );
  }

  async findUserByNormalizedPhone(phone: string): Promise<IdentityUserRecord | null> {
    const normalizedPhone = normalizeOtpPhoneInput(phone);
    if (!normalizedPhone) {
      return null;
    }
    return asUser(
      await this.userRepository
        // tenant-isolation:qb-exempt — global users.phone lookup for OTP auth (not tenant-scoped)
        .createQueryBuilder("u")
        .where("u.deleted_at IS NULL")
        .andWhere("phone_normalized(COALESCE(u.phone, '')) = phone_normalized(:phone)", {
          phone: normalizedPhone
        })
        .getOne()
    );
  }

  async findUserByNormalizedPhoneExclusive(
    phone: string,
    excludeUserId: string
  ): Promise<IdentityUserRecord | null> {
    const normalizedPhone = normalizeOtpPhoneInput(phone);
    if (!normalizedPhone) {
      return null;
    }
    return asUser(
      await this.userRepository
        // tenant-isolation:qb-exempt — global users.phone lookup for OTP auth (not tenant-scoped)
        .createQueryBuilder("u")
        .where("u.deleted_at IS NULL")
        .andWhere("u.id != :excludeUserId", { excludeUserId })
        .andWhere("phone_normalized(u.phone) = phone_normalized(:phone)", { phone: normalizedPhone })
        .getOne()
    );
  }

  async saveUser(user: IdentityUserRecord, manager?: EntityManager): Promise<IdentityUserRecord> {
    const saved = await this.userRepo(manager).save(user as UserEntity);
    return asUser(saved)!;
  }

  async deletePendingEmailVerificationTokens(
    userId: string,
    manager: EntityManager
  ): Promise<void> {
    await manager
      // tenant-isolation:qb-exempt — delete unused tokens by user_id (global auth table)
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationTokenEntity)
      .where("user_id = :userId AND used_at IS NULL", { userId })
      .execute();
  }

  createEmailVerificationToken(
    data: DeepPartial<IdentityEmailVerificationTokenRecord>,
    manager: EntityManager
  ): IdentityEmailVerificationTokenRecord {
    return asEmailToken(
      manager.getRepository(EmailVerificationTokenEntity).create(data as DeepPartial<EmailVerificationTokenEntity>)
    )!;
  }

  async saveEmailVerificationToken(
    row: IdentityEmailVerificationTokenRecord,
    manager: EntityManager
  ): Promise<IdentityEmailVerificationTokenRecord> {
    const saved = await manager
      .getRepository(EmailVerificationTokenEntity)
      .save(row as EmailVerificationTokenEntity);
    return asEmailToken(saved)!;
  }

  async findLockedValidEmailVerificationToken(
    token: string,
    manager: EntityManager
  ): Promise<IdentityEmailVerificationTokenRecord | null> {
    return asEmailToken(
      await manager.findOne(EmailVerificationTokenEntity, {
        where: {
          token,
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date())
        },
        lock: { mode: "pessimistic_write" }
      })
    );
  }

  async findActiveMembership(
    tenantId: string,
    userId: string,
    options?: { status?: MembershipStatus },
    manager?: EntityManager
  ): Promise<IdentityMembershipRecord | null> {
    const repo = manager ? manager.getRepository(UserTenantEntity) : this.membershipRepository;
    return asMembership(
      await repo.findOne({
        where: {
          tenantId,
          userId,
          deletedAt: IsNull(),
          ...(options?.status ? { status: options.status } : {})
        }
      })
    );
  }

  findActiveMembershipsByUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Array<Pick<UserTenantEntity, "userId" | "role" | "membershipMetadata">>> {
    const unique = [...new Set(userIds)].filter((id) => id.trim().length > 0);
    if (unique.length === 0) {
      return Promise.resolve([]);
    }
    return this.membershipRepository.find({
      where: {
        tenantId,
        userId: In(unique),
        deletedAt: IsNull(),
        status: MembershipStatus.ACTIVE
      },
      select: {
        userId: true,
        role: true,
        membershipMetadata: true
      }
    });
  }

  async listWorkspaceMembers(
    tenantId: string,
    filters?: WorkspaceMemberListFilters
  ): Promise<IdentityMembershipRecord[]> {
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
    const rows = await this.membershipRepository.find({
      where: {
        tenantId,
        deletedAt: IsNull(),
        ...(filters?.status ? { status: filters.status } : {})
      },
      order: { createdAt: "DESC" },
      take: limit
    });
    return asMembershipList(rows);
  }

  listTenantUsers(query: TenantUsersListQuery): Promise<TenantUsersListRow[]> {
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

  async findTenantScopedUserRow(
    tenantId: string,
    userId: string
  ): Promise<TenantScopedUserRow | null> {
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
        "u.last_active_at AS last_active_at",
        "u.gender AS gender",
        "u.profile_image_url AS profile_image_url",
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

  async findPendingInviteByToken(token: string): Promise<IdentityWorkspaceInviteRecord | null> {
    return asInvite(
      await this.workspaceInviteRepository.findOne({
        where: { inviteToken: token }
      })
    );
  }

  async saveInvite(
    invite: IdentityWorkspaceInviteRecord,
    manager?: EntityManager
  ): Promise<IdentityWorkspaceInviteRecord> {
    const repo = manager ? manager.getRepository(WorkspaceInviteEntity) : this.workspaceInviteRepository;
    const saved = await repo.save(invite as WorkspaceInviteEntity);
    return asInvite(saved)!;
  }

  createInvite(data: DeepPartial<IdentityWorkspaceInviteRecord>): IdentityWorkspaceInviteRecord {
    return asInvite(this.workspaceInviteRepository.create(data as DeepPartial<WorkspaceInviteEntity>))!;
  }

  async findInviteById(
    tenantId: string,
    inviteId: string
  ): Promise<IdentityWorkspaceInviteRecord | null> {
    return asInvite(
      await this.workspaceInviteRepository.findOne({
        where: { id: inviteId, tenantId }
      })
    );
  }

  async findPendingInvitesByTenant(
    tenantId: string,
    now: Date
  ): Promise<IdentityWorkspaceInviteRecord[]> {
    const rows = await this.workspaceInviteRepository.find({
      where: {
        tenantId,
        status: WorkspaceInviteStatus.PENDING,
        expiresAt: MoreThan(now)
      },
      order: { expiresAt: "ASC" }
    });
    return asInviteList(rows);
  }

  async updateInviteStatus(
    id: string,
    status: WorkspaceInviteStatus,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager ? manager.getRepository(WorkspaceInviteEntity) : this.workspaceInviteRepository;
    await repo.update({ id }, { status });
  }

  async saveMembership(
    membership: IdentityMembershipRecord,
    manager?: EntityManager
  ): Promise<IdentityMembershipRecord> {
    const repo = manager ? manager.getRepository(UserTenantEntity) : this.membershipRepository;
    const saved = await repo.save(membership as UserTenantEntity);
    return asMembership(saved)!;
  }

  createMembership(data: DeepPartial<IdentityMembershipRecord>): IdentityMembershipRecord {
    return asMembership(this.membershipRepository.create(data as DeepPartial<UserTenantEntity>))!;
  }

  async deleteMembershipById(id: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(UserTenantEntity) : this.membershipRepository;
    await repo.delete({ id });
  }

  async removeInvite(invite: IdentityWorkspaceInviteRecord, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(WorkspaceInviteEntity) : this.workspaceInviteRepository;
    await repo.remove(invite as WorkspaceInviteEntity);
  }

  updateMembership(
    criteria: FindOptionsWhere<IdentityMembershipRecord>,
    partial: DeepPartial<IdentityMembershipRecord>
  ): Promise<UpdateResult> {
    return this.membershipRepository.update(
      criteria as FindOptionsWhere<UserTenantEntity>,
      partial as Parameters<Repository<UserTenantEntity>["update"]>[1]
    );
  }

  async findInvitedMembershipForPhone(
    tenantId: string,
    phone: string
  ): Promise<IdentityMembershipRecord | null> {
    const user = await this.findUserByNormalizedPhone(phone);
    if (!user) {
      return null;
    }
    return asMembership(
      await this.membershipRepository.findOne({
        where: {
          tenantId,
          userId: user.id,
          deletedAt: IsNull(),
          status: MembershipStatus.INVITED
        },
        select: ["id", "userId"]
      })
    );
  }

  async listUserRoleHistoryRows(
    tenantId: string,
    userId: string
  ): Promise<WorkspaceIdentityRoleHistoryRow[]> {
    return this.membershipRepository.manager
      .getRepository(UserRoleAuditEntity)
      .createQueryBuilder("audit")
      .innerJoin(UserEntity, "actor", "actor.id = audit.actor_user_id AND actor.deleted_at IS NULL")
      .where("audit.tenant_id = :tenantId", { tenantId })
      .andWhere("audit.target_user_id = :userId", { userId })
      .select([
        "audit.actor_user_id AS actor_user_id",
        "actor.email AS actor_email",
        "audit.old_role AS old_role",
        "audit.new_role AS new_role",
        "audit.created_at AS created_at"
      ])
      .orderBy("audit.created_at", "DESC")
      .limit(50)
      .getRawMany<WorkspaceIdentityRoleHistoryRow>();
  }

  async resolveOperatingCurrencyCode(tenantId: string): Promise<string> {
    const row = await this.tenantRepository.findOne({
      where: { id: tenantId, deletedAt: IsNull() },
      select: ["id", "operatingCurrencyCode"]
    });
    return normalizeOperatingCurrencyCode(row?.operatingCurrencyCode);
  }

  async loadMemberWalletBalances(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, MemberWalletBalanceSnapshot>> {
    const out = new Map<string, MemberWalletBalanceSnapshot>();
    if (userIds.length === 0) {
      return out;
    }
    const currency = await this.resolveOperatingCurrencyCode(tenantId);
    const tenantNorm = normalizeFinanceTenantId(tenantId);
    const accounts = userIds.map((id) => memberWalletId(id));
    const rows = await this.accountBalanceRepository.find({
      where: {
        tenantId: tenantNorm,
        account: In(accounts),
        currency
      }
    });
    for (const row of rows) {
      const prefix = "member:";
      if (!row.account.startsWith(prefix)) {
        continue;
      }
      const userId = row.account.slice(prefix.length);
      if (!userId) {
        continue;
      }
      out.set(userId, {
        balanceMinor: row.balanceMinor?.trim() || "0",
        currency
      });
    }
    for (const userId of userIds) {
      if (!out.has(userId)) {
        out.set(userId, { balanceMinor: "0", currency });
      }
    }
    return out;
  }

  private buildRegistrationAggQueryBuilder(tenantId: string) {
    return this.registrationRepository
      .createQueryBuilder("r")
      .leftJoin(
        TourDepartureEntity,
        "td",
        "td.id = r.tour_departure_id AND td.tenant_id = r.tenant_id"
      )
      .leftJoin(TourEntity, "tour", "tour.id = r.tour_id AND tour.tenant_id = r.tenant_id")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.deleted_at IS NULL");
  }

  private async loadGroupedByPhones(
    tenantId: string,
    phones: readonly string[]
  ): Promise<GroupedTripAggRow[]> {
    if (phones.length === 0) {
      return [];
    }
    const cancelledList = CANCELLED_STATUSES.map((s) => `'${s}'`).join(", ");
    const nonCompletedList = NON_COMPLETED_STATUSES.map((s) => `'${s}'`).join(", ");
    return this.buildRegistrationAggQueryBuilder(tenantId)
      .select("r.participant_contact_phone", "bridge_key")
      .addSelect("COUNT(r.id)::int", "total_trips")
      .addSelect(
        `COUNT(r.id) FILTER (WHERE r.status IN (${cancelledList}))::int`,
        "cancelled_trips"
      )
      .addSelect(
        `COUNT(r.id) FILTER (WHERE r.status NOT IN (${nonCompletedList}) AND COALESCE(td.starts_on, tour.starts_on)::date < CURRENT_DATE)::int`,
        "completed_trips"
      )
      .andWhere("r.participant_contact_phone IN (:...phones)", { phones })
      .groupBy("r.participant_contact_phone")
      .getRawMany<GroupedTripAggRow>();
  }

  private async loadGroupedByTelegrams(
    tenantId: string,
    telegrams: readonly string[]
  ): Promise<GroupedTripAggRow[]> {
    if (telegrams.length === 0) {
      return [];
    }
    const cancelledList = CANCELLED_STATUSES.map((s) => `'${s}'`).join(", ");
    const nonCompletedList = NON_COMPLETED_STATUSES.map((s) => `'${s}'`).join(", ");
    return this.buildRegistrationAggQueryBuilder(tenantId)
      .select("r.telegram_user_id", "bridge_key")
      .addSelect("COUNT(r.id)::int", "total_trips")
      .addSelect(
        `COUNT(r.id) FILTER (WHERE r.status IN (${cancelledList}))::int`,
        "cancelled_trips"
      )
      .addSelect(
        `COUNT(r.id) FILTER (WHERE r.status NOT IN (${nonCompletedList}) AND COALESCE(td.starts_on, tour.starts_on)::date < CURRENT_DATE)::int`,
        "completed_trips"
      )
      .andWhere("r.telegram_user_id IN (:...telegrams)", { telegrams })
      .groupBy("r.telegram_user_id")
      .getRawMany<GroupedTripAggRow>();
  }

  async loadBookingSummariesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, UserBookingSummarySnapshot>> {
    const out = new Map<string, UserBookingSummarySnapshot>();
    if (userIds.length === 0) {
      return out;
    }

    const uniqueIds = [...new Set(userIds)];
    const users = await this.userRepository.find({
      where: { id: In(uniqueIds), deletedAt: IsNull() },
      select: ["id", "telegramUserId"]
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const phoneToUserId = new Map<string, string>();
    const telegramToUserId = new Map<string, string>();
    for (const userId of uniqueIds) {
      phoneToUserId.set(syntheticBookingContactPhone(userId), userId);
      const user = userById.get(userId);
      const telegram =
        typeof user?.telegramUserId === "string" && user.telegramUserId.trim() !== ""
          ? user.telegramUserId.trim()
          : undefined;
      if (telegram) {
        telegramToUserId.set(telegram, userId);
      }
      out.set(userId, emptyBookingSummary());
    }

    const phones = [...phoneToUserId.keys()];
    const telegrams = [...telegramToUserId.keys()];

    const [phoneRows, telegramRows] = await Promise.all([
      this.loadGroupedByPhones(tenantId, phones),
      this.loadGroupedByTelegrams(tenantId, telegrams)
    ]);

    const applyGrouped = (
      rows: GroupedTripAggRow[],
      keyToUserId: Map<string, string>
    ): void => {
      for (const row of rows) {
        const ownerId = keyToUserId.get(row.bridge_key?.trim() ?? "");
        if (!ownerId) {
          continue;
        }
        const slice: UserBookingSummarySnapshot = {
          totalTrips: parseCount(row.total_trips),
          cancelledTrips: parseCount(row.cancelled_trips),
          completedTrips: parseCount(row.completed_trips)
        };
        out.set(ownerId, mergeSummaries(out.get(ownerId) ?? emptyBookingSummary(), slice));
      }
    };

    applyGrouped(phoneRows, phoneToUserId);
    applyGrouped(telegramRows, telegramToUserId);

    return out;
  }

  async loadBookingTripsForUser(
    tenantId: string,
    userId: string
  ): Promise<UserBookingTripRowDto[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
      select: ["id", "telegramUserId"]
    });
    if (!user) {
      return [];
    }

    const phone = syntheticBookingContactPhone(userId);
    const telegram =
      typeof user.telegramUserId === "string" && user.telegramUserId.trim() !== ""
        ? user.telegramUserId.trim()
        : null;

    const rows = await this.buildRegistrationAggQueryBuilder(tenantId)
      .leftJoin(
        TourProductEntity,
        "product",
        "product.id = tour.tour_product_id AND product.tenant_id = r.tenant_id"
      )
      .select(
        `COALESCE(NULLIF(TRIM(tour.title), ''), NULLIF(TRIM(product.title), ''), '—')`,
        "tour_title"
      )
      .addSelect("COALESCE(td.starts_on, tour.starts_on)", "departure_on")
      .addSelect("r.status", "registration_status")
      .addSelect("r.payment_status", "payment_status")
      .andWhere(
        new Brackets((sub) => {
          sub.where("r.participant_contact_phone = :phone", { phone });
          if (telegram) {
            sub.orWhere("r.telegram_user_id = :telegram", { telegram });
          }
        })
      )
      .orderBy("COALESCE(td.starts_on, tour.starts_on)", "DESC", "NULLS LAST")
      .limit(TRIP_LIST_CAP)
      .getRawMany<TripRawRow>();

    return rows.map((row) => ({
      tourTitle: row.tour_title ?? "—",
      departureDate: formatDepartureDate(row.departure_on),
      registrationStatus: row.registration_status,
      paymentStatus: row.payment_status
    }));
  }

  async applyMembershipMetadataJsonbPatch(
    manager: EntityManager,
    input: MembershipMetadataJsonbPatchInput
  ): Promise<void> {
    await applyMembershipMetadataJsonbPatch(manager, input);
  }

  async updateMembershipRoleWithSessionBump(
    manager: EntityManager,
    tenantId: string,
    membershipId: string,
    role: string
  ): Promise<void> {
    await manager.query(
      `UPDATE user_tenants SET role = $1, session_version = session_version + 1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [role, membershipId, tenantId]
    );
  }

  async insertUserRoleAuditEntry(
    manager: EntityManager,
    row: UserRoleAuditInsertRow
  ): Promise<void> {
    await manager.insert(UserRoleAuditEntity, row);
  }

  async insertUserRoleAuditEntries(
    manager: EntityManager,
    rows: UserRoleAuditInsertRow[]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await manager
      // tenant-isolation:qb-exempt — bulk audit insert; tenant_id carried in row values
      .createQueryBuilder()
      .insert()
      .into(UserRoleAuditEntity)
      .values(rows)
      .execute();
  }

  async bulkUpdateMembershipRoles(
    manager: EntityManager,
    tenantId: string,
    membershipIds: readonly string[],
    role: string
  ): Promise<void> {
    if (membershipIds.length === 0) {
      return;
    }
    await manager.query(
      `UPDATE user_tenants
         SET role = $1,
             session_version = session_version + 1,
             updated_at = now()
       WHERE tenant_id = $2
         AND deleted_at IS NULL
         AND id = ANY($3::uuid[])`,
      [role, tenantId, membershipIds]
    );
  }

  async findActiveMembershipsByUserIdsInTransaction(
    manager: EntityManager,
    tenantId: string,
    userIds: readonly string[]
  ): Promise<IdentityMembershipRecord[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await manager.find(UserTenantEntity, {
      where: { tenantId, userId: In([...userIds]), deletedAt: IsNull() }
    });
    return asMembershipList(rows);
  }

  async loadBulkUserMembershipSummaryRows(
    manager: EntityManager,
    tenantId: string,
    userIds: readonly string[]
  ): Promise<BulkUserMembershipSummaryRow[]> {
    if (userIds.length === 0) {
      return [];
    }
    return manager
      .createQueryBuilder(UserEntity, "u")
      .innerJoin(
        UserTenantEntity,
        "ut",
        "ut.user_id = u.id AND ut.tenant_id = :tenantId AND ut.deleted_at IS NULL",
        { tenantId }
      )
      .where("u.id IN (:...userIds)", { userIds: [...userIds] })
      .andWhere("u.deleted_at IS NULL")
      .select([
        "u.id AS id",
        "u.full_name AS full_name",
        "u.email AS email",
        "u.phone AS phone",
        "u.is_email_verified AS is_email_verified",
        "u.is_phone_verified AS is_phone_verified",
        "ut.membership_status AS membership_status"
      ])
      .getRawMany<BulkUserMembershipSummaryRow>();
  }

  async deleteMembershipHard(manager: EntityManager, membershipId: string): Promise<void> {
    await manager.getRepository(UserTenantEntity).delete({ id: membershipId });
  }

  async findActiveMembershipForUpdateLocking(
    manager: EntityManager,
    tenantId: string,
    userId: string
  ): Promise<IdentityMembershipRecord | null> {
    return asMembership(
      await manager.findOne(UserTenantEntity, {
        where: { tenantId, userId, deletedAt: IsNull() },
        lock: { mode: "pessimistic_write" }
      })
    );
  }

  async updateMembershipLabels(
    manager: EntityManager,
    membershipId: string,
    tenantId: string,
    labels: string[]
  ): Promise<void> {
    await manager.getRepository(UserTenantEntity).update({ id: membershipId, tenantId }, { labels });
  }

  async executeWorkspaceOwnershipTransfer(
    manager: EntityManager,
    input: WorkspaceOwnershipTransferMutation
  ): Promise<void> {
    await manager.query(
      `UPDATE user_tenants
         SET role = $1,
             session_version = session_version + 1,
             updated_at = now()
       WHERE id = $2 AND tenant_id = $3`,
      [UserRole.Admin, input.actorMembershipId, input.tenantId]
    );

    await manager.query(
      `UPDATE user_tenants
         SET role = $1,
             session_version = session_version + 1,
             updated_at = now()
       WHERE id = $2 AND tenant_id = $3`,
      [UserRole.Owner, input.targetMembershipId, input.tenantId]
    );

    await manager
      .createQueryBuilder()
      .insert()
      .into(UserRoleAuditEntity)
      .values([
        {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          targetUserId: input.actorUserId,
          oldRole: input.actorPriorRole,
          newRole: UserRole.Admin
        },
        {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          targetUserId: input.newOwnerUserId,
          oldRole: input.targetPriorRole,
          newRole: UserRole.Owner
        }
      ])
      .execute();
  }

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }
}
