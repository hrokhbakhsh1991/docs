import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, IsNull, Repository } from "typeorm";
import { syntheticBookingContactPhone } from "../../common/security/ownership-scope";
import { RegistrationEntity, RegistrationStatus } from "../registrations/registration.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourProductEntity } from "../tours/entities/tour-product.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { UserEntity } from "./entities/user.entity";
import type { UserBookingTripRowDto } from "./dto/user-booking-trip-row.dto";
import type { UserBookingSummaryResponseDto } from "./dto/user-booking-summary-response.dto";

export type UserBookingSummaryCounts = Pick<
  UserBookingSummaryResponseDto,
  "totalTrips" | "completedTrips" | "cancelledTrips"
>;
export type UserBookingSummarySnapshot = UserBookingSummaryCounts;

const TRIP_LIST_CAP = 50;

const CANCELLED_STATUSES = [RegistrationStatus.CANCELLED, RegistrationStatus.REJECTED];
const NON_COMPLETED_STATUSES = [
  RegistrationStatus.CANCELLED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.NO_SHOW
];

type GroupedTripAggRow = {
  bridge_key: string;
  total_trips: string;
  cancelled_trips: string;
  completed_trips: string;
};

function emptySummary(): UserBookingSummaryCounts {
  return { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };
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

type TripRawRow = {
  tour_title: string;
  departure_on: string | Date | null;
  registration_status: string;
  payment_status: string;
};

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

@Injectable()
export class WorkspaceUserBookingSummaryService {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrations: Repository<RegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>
  ) {}

  private buildRegistrationAggQueryBuilder(tenantId: string) {
    return this.registrations
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

  /**
   * SQL GROUP BY aggregations per phone/telegram bridge (no raw registration row fan-out).
   */
  async loadBookingSummariesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, UserBookingSummarySnapshot>> {
    const out = new Map<string, UserBookingSummarySnapshot>();
    if (userIds.length === 0) {
      return out;
    }

    const uniqueIds = [...new Set(userIds)];
    const users = await this.users.find({
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
      out.set(userId, emptySummary());
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
        out.set(ownerId, mergeSummaries(out.get(ownerId) ?? emptySummary(), slice));
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
    const user = await this.users.findOne({
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
}
