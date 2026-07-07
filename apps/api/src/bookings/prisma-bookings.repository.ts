import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { getPrismaAdmin } from "../db/prisma";
import {
  MAX_OUTBOX_EVENTS_PER_AGGREGATE,
  OUTBOX_EVENT_LIST_SELECT,
} from "./bookings-outbox-projection";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { normalizeBookingSearchQuery, startOfUtcDay } from "./booking-list-query";
import type {
  ActiveDuplicateByEmailInput,
  ActiveDuplicateByGuestLabelInput,
  ActiveDuplicateByNationalIdInput,
  ActiveDuplicateByUserInput,
  BookingListPageInput,
  BookingListPageOutput,
  BookingOutboxRecord,
  BookingRecord,
  BookingStatus,
  BookingTourChip,
  BookingsSummaryCounts,
  CreateBookingRequest,
} from "./bookings.types";
import { INACTIVE_DUPLICATE_STATUSES } from "./booking-active-duplicate";
import {
  CANCELLED_BOOKING_STATUSES,
  MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
  MAX_MEMBER_BOOKINGS_LIST_CAP,
} from "./bookings-member-summary-projection";
import type { BookingsRepository } from "./in-memory-bookings.repository";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./in-memory-bookings.repository";

/** List projection — excludes `registrationIntake` JSON (detail path uses `getById`). */
export const BOOKING_LIST_SELECT = {
  id: true,
  tenantId: true,
  tourId: true,
  tourTitle: true,
  guestLabel: true,
  guestEmail: true,
  guestPhone: true,
  partySize: true,
  status: true,
  paymentStatus: true,
  departureAt: true,
  submittedAt: true,
  submittedByUserId: true,
  approvedAt: true,
} as const satisfies Prisma.OperatorRegistrationSelect;

type BookingListRow = Prisma.OperatorRegistrationGetPayload<{
  select: typeof BOOKING_LIST_SELECT;
}>;

function toBookingListRecord(row: BookingListRow): BookingRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tourId: row.tourId,
    tourTitle: row.tourTitle,
    guestLabel: row.guestLabel,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    partySize: row.partySize,
    status: row.status as BookingStatus,
    paymentStatus: row.paymentStatus as BookingRecord["paymentStatus"],
    departureAt: row.departureAt.toISOString(),
    submittedAt: row.submittedAt.toISOString(),
    submittedByUserId: row.submittedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

function toBookingRecord(row: {
  id: string;
  tenantId: string;
  tourId: string;
  tourTitle: string;
  guestLabel: string;
  guestEmail: string | null;
  guestPhone: string | null;
  partySize: number;
  status: string;
  paymentStatus: string;
  departureAt: Date;
  submittedAt: Date;
  submittedByUserId: string;
  approvedAt: Date | null;
  registrationIntake?: Prisma.JsonValue | null;
}): BookingRecord {
  const registrationIntake =
    row.registrationIntake !== null &&
    row.registrationIntake !== undefined &&
    typeof row.registrationIntake === "object" &&
    !Array.isArray(row.registrationIntake)
      ? (row.registrationIntake as Readonly<Record<string, unknown>>)
      : undefined;
  return {
    id: row.id,
    tenantId: row.tenantId,
    tourId: row.tourId,
    tourTitle: row.tourTitle,
    guestLabel: row.guestLabel,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    partySize: row.partySize,
    status: row.status as BookingStatus,
    paymentStatus: row.paymentStatus as BookingRecord["paymentStatus"],
    departureAt: row.departureAt.toISOString(),
    submittedAt: row.submittedAt.toISOString(),
    submittedByUserId: row.submittedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    ...(registrationIntake !== undefined ? { registrationIntake } : {}),
  };
}

function toOutboxRecord(row: {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  domainEventId: string | null;
  createdAt: Date;
}): BookingOutboxRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    payload: row.payload as Record<string, unknown>,
    domainEventId: row.domainEventId ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

function buildBookingListWhere(
  input: Omit<BookingListPageInput, "limit" | "cursor">
): Prisma.OperatorRegistrationWhereInput {
  const q = normalizeBookingSearchQuery(input.q);
  return {
    tenantId: input.tenantId,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.tourId !== undefined && input.tourId.length > 0 ? { tourId: input.tourId } : {}),
    ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
    ...(input.submittedByUserId !== undefined ? { submittedByUserId: input.submittedByUserId } : {}),
    ...(q !== undefined
      ? {
          OR: [
            { guestLabel: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            { guestPhone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function applyKeysetCursor(
  baseWhere: Prisma.OperatorRegistrationWhereInput,
  cursor: { submittedAt: Date; id: string }
): Prisma.OperatorRegistrationWhereInput {
  return {
    AND: [
      baseWhere,
      {
        OR: [
          { submittedAt: { lt: cursor.submittedAt } },
          {
            submittedAt: cursor.submittedAt,
            id: { lt: cursor.id },
          },
        ],
      },
    ],
  };
}

function activeDuplicateWhere(
  tenantId: string,
  tourId: string
): Prisma.OperatorRegistrationWhereInput {
  return {
    tenantId,
    tourId,
    status: { notIn: [...INACTIVE_DUPLICATE_STATUSES] },
  };
}

function assertTenantId(tenantId: string): void {
  if (tenantId.trim().length === 0) {
    throw new Error("TENANT_ID_REQUIRED");
  }
}

export class PrismaBookingsRepository implements BookingsRepository {
  /** @deprecated Test/perf baseline — delegates to listByTenantPage (cap 500). */
  async listByTenant(tenantId: string): Promise<BookingRecord[]> {
    const page = await this.listByTenantPage({
      tenantId,
      limit: MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
    });
    return [...page.items];
  }

  async listBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<BookingRecord[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.findMany({
        where: { tenantId, submittedByUserId },
        select: BOOKING_LIST_SELECT,
        orderBy: [{ departureAt: "desc" }, { id: "desc" }],
        take: MAX_MEMBER_BOOKINGS_LIST_CAP,
      })
    );
    return rows.map((row) => toBookingListRecord(row));
  }

  async countBookingsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<number> {
    return withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.count({
        where: { tenantId, submittedByUserId },
      })
    );
  }

  async countCancelledBookingsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<number> {
    return withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.count({
        where: {
          tenantId,
          submittedByUserId,
          status: { in: [...CANCELLED_BOOKING_STATUSES] },
        },
      })
    );
  }

  async countCompletedTripsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    now: Date
  ): Promise<number> {
    return withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.count({
        where: {
          tenantId,
          submittedByUserId,
          status: { notIn: [...CANCELLED_BOOKING_STATUSES] },
          departureAt: { lt: now },
        },
      })
    );
  }

  async listRecentBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    limit: number
  ): Promise<BookingRecord[]> {
    const capped = Math.min(Math.max(limit, 1), MAX_MEMBER_BOOKINGS_LIST_CAP);
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.findMany({
        where: { tenantId, submittedByUserId },
        select: BOOKING_LIST_SELECT,
        orderBy: [{ departureAt: "desc" }, { id: "desc" }],
        take: capped,
      })
    );
    return rows.map((row) => toBookingListRecord(row));
  }

  async findActiveDuplicateByUser(
    input: ActiveDuplicateByUserInput
  ): Promise<BookingRecord | null> {
    const normalizedUserId = input.submittedByUserId.trim();
    if (normalizedUserId.length === 0) {
      return null;
    }
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.findFirst({
        where: {
          ...activeDuplicateWhere(input.tenantId, input.tourId),
          submittedByUserId: normalizedUserId,
        },
      })
    );
    return row === null ? null : toBookingRecord(row);
  }

  async findActiveDuplicateByGuestLabel(
    input: ActiveDuplicateByGuestLabelInput
  ): Promise<BookingRecord | null> {
    const normalizedLabel = input.guestLabel.trim();
    if (normalizedLabel.length === 0) {
      return null;
    }
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.findFirst({
        where: {
          ...activeDuplicateWhere(input.tenantId, input.tourId),
          guestLabel: { equals: normalizedLabel, mode: "insensitive" },
        },
      })
    );
    return row === null ? null : toBookingRecord(row);
  }

  async findActiveDuplicateByEmail(
    input: ActiveDuplicateByEmailInput
  ): Promise<BookingRecord | null> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail.length === 0) {
      return null;
    }
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.findFirst({
        where: {
          ...activeDuplicateWhere(input.tenantId, input.tourId),
          guestEmail: { equals: normalizedEmail, mode: "insensitive" },
        },
      })
    );
    return row === null ? null : toBookingRecord(row);
  }

  async findActiveDuplicateByNationalId(
    input: ActiveDuplicateByNationalIdInput
  ): Promise<BookingRecord | null> {
    const normalizedNationalId = input.nationalId.trim();
    if (normalizedNationalId.length === 0) {
      return null;
    }
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.findFirst({
        where: {
          ...activeDuplicateWhere(input.tenantId, input.tourId),
          registrationIntake: {
            path: ["nationalId"],
            equals: normalizedNationalId,
          },
        },
      })
    );
    return row === null ? null : toBookingRecord(row);
  }

  async listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput> {
    const baseWhere = buildBookingListWhere(input);

    const rows = await withTenantRls(input.tenantId, async (tx) => {
      let where = baseWhere;

      if (input.cursor !== undefined && input.cursor.length > 0) {
        const cursorRow = await tx.operatorRegistration.findFirst({
          where: { id: input.cursor, tenantId: input.tenantId },
          select: { id: true, submittedAt: true },
        });
        if (cursorRow !== null) {
          where = applyKeysetCursor(baseWhere, {
            id: cursorRow.id,
            submittedAt: cursorRow.submittedAt,
          });
        }
      }

      return tx.operatorRegistration.findMany({
        where,
        select: BOOKING_LIST_SELECT,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
      });
    });

    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const items = pageRows.map(toBookingListRecord);

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    };
  }

  async countByListFilters(
    input: Omit<BookingListPageInput, "limit" | "cursor">
  ): Promise<number> {
    return withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.count({
        where: buildBookingListWhere(input),
      })
    );
  }

  async getBookingsSummaryCounts(tenantId: string, now: Date): Promise<BookingsSummaryCounts> {
    const dayStart = startOfUtcDay(now);
    const departuresEnd = new Date(now);
    departuresEnd.setUTCDate(departuresEnd.getUTCDate() + 7);

    return withTenantRls(tenantId, async (tx) => {
      const [pending, waitlist, approvedToday, departures7d] = await Promise.all([
        tx.operatorRegistration.count({
          where: { tenantId, status: "pending" },
        }),
        tx.operatorRegistration.count({
          where: { tenantId, status: "waitlisted" },
        }),
        tx.operatorRegistration.count({
          where: {
            tenantId,
            status: "approved",
            approvedAt: { gte: dayStart },
          },
        }),
        tx.operatorRegistration.count({
          where: {
            tenantId,
            departureAt: { gte: now, lte: departuresEnd },
          },
        }),
      ]);

      return { pending, waitlist, approvedToday, departures7d };
    });
  }

  async listTourChipsByTenant(tenantId: string): Promise<readonly BookingTourChip[]> {
    const [totals, pendingByTour] = await withTenantRls(tenantId, async (tx) =>
      Promise.all([
        tx.operatorRegistration.groupBy({
          by: ["tourId", "tourTitle"],
          where: { tenantId },
          _count: { _all: true },
        }),
        tx.operatorRegistration.groupBy({
          by: ["tourId"],
          where: { tenantId, status: "pending" },
          _count: { _all: true },
        }),
      ])
    );

    const pendingMap = new Map(
      pendingByTour.map((row) => [row.tourId, row._count._all])
    );

    return totals
      .map((row) => ({
        tourId: row.tourId,
        tourTitle: row.tourTitle,
        pendingCount: pendingMap.get(row.tourId) ?? 0,
        totalCount: row._count._all,
      }))
      .sort((left, right) => right.pendingCount - left.pendingCount);
  }

  async sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>> {
    if (tourIds.length === 0) {
      return {};
    }
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.groupBy({
        by: ["tourId"],
        where: {
          tenantId,
          tourId: { in: [...tourIds] },
          status: "approved",
        },
        _sum: { partySize: true },
      })
    );
    const totals: Record<string, number> = {};
    for (const row of rows) {
      totals[row.tourId] = row._sum.partySize ?? 0;
    }
    return totals;
  }

  async getById(id: string, tenantId: string): Promise<BookingRecord | null> {
    assertTenantId(tenantId);
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.operatorRegistration.findFirst({
        where: { id, tenantId },
      });
      return row === null ? null : toBookingRecord(row);
    });
  }

  async listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]> {
    const booking = await getPrismaAdmin().operatorRegistration.findUnique({
      where: { id: aggregateId },
      select: { tenantId: true },
    });
    if (booking === null) {
      return [];
    }
    const rows = await withTenantRls(booking.tenantId, (tx) =>
      tx.outboxEvent.findMany({
        where: { tenantId: booking.tenantId, aggregateId },
        select: OUTBOX_EVENT_LIST_SELECT,
        orderBy: { createdAt: "asc" },
        take: MAX_OUTBOX_EVENTS_PER_AGGREGATE,
      })
    );
    return rows.map((row) => toOutboxRecord(row));
  }

  async createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
  }): Promise<BookingRecord> {
    const row = await withTenantRls(input.tenantId, (tx) =>
      tx.operatorRegistration.create({
        data: {
          tenantId: input.tenantId,
          tourId: input.body.tourId,
          tourTitle: input.body.tourTitle,
          guestLabel: input.body.guestLabel,
          guestEmail: input.body.guestEmail ?? null,
          guestPhone: input.body.guestPhone ?? null,
          partySize: input.body.partySize,
          status: "pending",
          paymentStatus: input.body.paymentStatus ?? "unpaid",
          departureAt: new Date(input.body.departureAt),
          submittedByUserId: input.submittedByUserId,
          ...(input.body.registrationIntake !== undefined
            ? { registrationIntake: input.body.registrationIntake as Prisma.InputJsonValue }
            : {}),
        },
      })
    );
    return toBookingRecord(row);
  }

  async approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
  }): Promise<BookingRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const current = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (current === null) {
        throw new BookingNotFoundError();
      }
      if (current.status !== "pending" && current.status !== "waitlisted") {
        throw new BookingStatusConflictError(current.status as BookingStatus);
      }

      const approvedAt = new Date();
      const updated = await tx.operatorRegistration.update({
        where: { id: current.id },
        data: { status: "approved", approvedAt },
      });

      const domainEventId = `registration.approved:${updated.id}:${approvedAt.toISOString()}`;
      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: updated.id,
        eventType: input.outboxEvent,
        payload: {
          bookingId: updated.id,
          tourId: updated.tourId,
          status: updated.status,
          approvedAt: approvedAt.toISOString(),
          ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        },
        domainEventId,
        createdAt: approvedAt,
      });

      return toBookingRecord(updated);
    });
  }

  async bulkApproveWithOutbox(input: {
    ids: readonly string[];
    tenantId: string;
    outboxEvent: string;
    maxBatch: number;
  }): Promise<BookingRecord[]> {
    if (input.ids.length > input.maxBatch) {
      throw new BulkApproveBatchLimitError(input.maxBatch);
    }

    return withTenantRls(input.tenantId, async (tx) => {
      const rows = await tx.operatorRegistration.findMany({
        where: { tenantId: input.tenantId, id: { in: [...input.ids] } },
        take: input.ids.length,
      });
      const eligible = rows.filter(
        (row) => row.status === "pending" || row.status === "waitlisted"
      );
      if (eligible.length === 0) {
        return [];
      }

      const approvedAt = new Date();
      await tx.operatorRegistration.updateMany({
        where: {
          tenantId: input.tenantId,
          id: { in: eligible.map((row) => row.id) },
        },
        data: { status: "approved", approvedAt },
      });

      for (const row of eligible) {
        const domainEventId = `registration.approved:${row.id}:${approvedAt.toISOString()}`;
        await enqueueOutboxEvent(tx, {
          tenantId: input.tenantId,
          aggregateType: "registration",
          aggregateId: row.id,
          eventType: input.outboxEvent,
          payload: {
            bookingId: row.id,
            tourId: row.tourId,
            status: "approved",
            approvedAt: approvedAt.toISOString(),
          },
          domainEventId,
          createdAt: approvedAt,
        });
      }

      const updated = await tx.operatorRegistration.findMany({
        where: {
          tenantId: input.tenantId,
          id: { in: eligible.map((row) => row.id) },
        },
        take: eligible.length,
      });
      return updated.map((row) => toBookingRecord(row));
    });
  }

  async rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord> {
    void input.reason;
    return withTenantRls(input.tenantId, async (tx) => {
      const current = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (current === null) {
        throw new BookingNotFoundError();
      }
      if (current.status !== "pending" && current.status !== "waitlisted") {
        throw new BookingStatusConflictError(current.status as BookingStatus);
      }
      const updated = await tx.operatorRegistration.update({
        where: { id: current.id },
        data: { status: "rejected", approvedAt: null },
      });
      return toBookingRecord(updated);
    });
  }

  seedBooking(_record: BookingRecord): void {
    throw new Error("BOOKINGS_SEED_REQUIRES_MEMORY_DRIVER");
  }
}
