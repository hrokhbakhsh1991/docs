import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { syntheticBookingContactPhone } from "../../common/security/ownership-scope";
import { RegistrationEntity, RegistrationStatus } from "../registrations/registration.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { UserEntity } from "./entities/user.entity";
import type { UserBookingSummaryResponseDto } from "./dto/user-booking-summary-response.dto";

export type UserBookingSummarySnapshot = UserBookingSummaryResponseDto;

const CANCELLED_STATUSES = new Set<string>([
  RegistrationStatus.CANCELLED,
  RegistrationStatus.REJECTED
]);

const NON_COMPLETED_STATUSES = new Set<string>([
  RegistrationStatus.CANCELLED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.NO_SHOW
]);

type RegistrationTripRow = {
  status: string;
  departure_on: string | null;
};

function utcTodayYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function departureIsPast(departureOn: string | null, todayYmd: string): boolean {
  if (!departureOn || departureOn.trim() === "") {
    return false;
  }
  return departureOn.trim().slice(0, 10) < todayYmd;
}

function aggregateTripRows(rows: RegistrationTripRow[]): UserBookingSummarySnapshot {
  const todayYmd = utcTodayYmd();
  let cancelledTrips = 0;
  let completedTrips = 0;
  for (const row of rows) {
    const status = String(row.status ?? "").trim();
    if (CANCELLED_STATUSES.has(status)) {
      cancelledTrips += 1;
      continue;
    }
    if (!NON_COMPLETED_STATUSES.has(status) && departureIsPast(row.departure_on, todayYmd)) {
      completedTrips += 1;
    }
  }
  return {
    totalTrips: rows.length,
    completedTrips,
    cancelledTrips
  };
}

function emptySummary(): UserBookingSummarySnapshot {
  return { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };
}

@Injectable()
export class WorkspaceUserBookingSummaryService {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrations: Repository<RegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>
  ) {}

  /**
   * One registration query for the whole page slice (`IN` phones/telegrams). Never call per user row.
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
    if (phones.length === 0 && telegrams.length === 0) {
      return out;
    }

    const qb = this.registrations
      .createQueryBuilder("r")
      .leftJoin(TourDepartureEntity, "td", "td.id = r.tour_departure_id AND td.tenant_id = r.tenant_id")
      .leftJoin(TourEntity, "tour", "tour.id = r.tour_id AND tour.tenant_id = r.tenant_id")
      .select("r.status", "status")
      .addSelect("r.participant_contact_phone", "participant_contact_phone")
      .addSelect("r.telegram_user_id", "telegram_user_id")
      .addSelect("COALESCE(td.starts_on::text, tour.starts_on::text)", "departure_on")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.deleted_at IS NULL");

    const matchParts: string[] = [];
    const params: Record<string, unknown> = { tenantId };
    if (phones.length > 0) {
      matchParts.push("r.participant_contact_phone IN (:...phones)");
      params.phones = phones;
    }
    if (telegrams.length > 0) {
      matchParts.push("r.telegram_user_id IN (:...telegrams)");
      params.telegrams = telegrams;
    }
    qb.andWhere(`(${matchParts.join(" OR ")})`, params);

    const rawRows = await qb.getRawMany<{
      status: string;
      participant_contact_phone: string;
      telegram_user_id: string | null;
      departure_on: string | null;
    }>();

    const rowsByUserId = new Map<string, RegistrationTripRow[]>();
    for (const raw of rawRows) {
      let ownerId = phoneToUserId.get(raw.participant_contact_phone?.trim() ?? "");
      if (!ownerId && raw.telegram_user_id) {
        ownerId = telegramToUserId.get(raw.telegram_user_id.trim());
      }
      if (!ownerId) {
        continue;
      }
      const bucket = rowsByUserId.get(ownerId) ?? [];
      bucket.push({ status: raw.status, departure_on: raw.departure_on });
      rowsByUserId.set(ownerId, bucket);
    }

    for (const userId of uniqueIds) {
      out.set(userId, aggregateTripRows(rowsByUserId.get(userId) ?? []));
    }
    return out;
  }
}
