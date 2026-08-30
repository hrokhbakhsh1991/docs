import { buildIranMobileSearchPatterns } from "@app-tour/iran-mobile";
import { Prisma } from "@prisma/client";

import {
  canTransitionBookingStatus,
  listBookingSourceStatusesForTarget,
} from "./booking-status-transitions";

import { resolveLoginMobileLookupKeys } from "../identity/canonicalize-login-mobile";
import { withTenantRls } from "../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { normalizeBookingSearchQuery } from "./booking-list-query";
import type {
  BookingListPageInput,
  BookingListPageOutput,
  BookingPaymentStatus,
  BookingRecord,
  BookingStatus,
  CreateBookingRequest,
} from "./bookings.types";
import { raiseBookingPaymentStatus } from "./booking-payment-status";
import { finalizeBookingTourChips } from "./booking-tour-chips";
import {
  CANCELLED_BOOKING_STATUSES,
  MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
  MAX_MEMBER_BOOKINGS_LIST_CAP,
} from "./bookings-member-summary-projection";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";
import { enrichBookingListRecordsWithIntakeScalars } from "./booking-list-intake-scalars";
import { readRegistrantTargetFromIntake } from "./read-registrant-target";
import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
} from "./read-transport-kind-from-intake";

/**
 * Serialize capacity + status decisions for one tour inside an open tenant TX.
 *
 * Lock key = two int4 slices of md5(tenantId || ':' || tourId) — one composite key,
 * not independent hashtext(tenant) / hashtext(tour) (cross-pair collision class).
 * Transaction-scoped: released on COMMIT/ROLLBACK. READ COMMITTED isolation.
 */
async function acquireTourCapacityLock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tourId: string
): Promise<void> {
  const lockKey = `${tenantId.trim()}:${tourId.trim()}`;
  // $executeRaw — pg_advisory_xact_lock returns void (queryRaw cannot deserialize it).
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ('x' || substr(md5(${lockKey}), 1, 8))::bit(32)::int,
      ('x' || substr(md5(${lockKey}), 9, 8))::bit(32)::int
    )
  `;
}

async function sumApprovedPartySizeInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tourId: string
): Promise<number> {
  const occupancy = await tx.operatorRegistration.aggregate({
    where: {
      tenantId,
      tourId,
      status: "approved",
    },
    _sum: { partySize: true },
  });
  return occupancy._sum.partySize ?? 0;
}

/** List projection — omits `registrationIntake` (BK-SAFE-01 / list-projection guards). */
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
  rejectReason: true,
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
    ...(row.rejectReason !== null && row.rejectReason.length > 0
      ? { rejectReason: row.rejectReason }
      : {}),
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
  rejectReason?: string | null;
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
    registrantTarget: readRegistrantTargetFromIntake(registrationIntake),
    transportKind: readTransportKindFromIntake(registrationIntake),
    personalCarOccupants: readPersonalCarOccupantsFromIntake(registrationIntake),
    ...(row.rejectReason !== null && row.rejectReason !== undefined && row.rejectReason.length > 0
      ? { rejectReason: row.rejectReason }
      : {}),
  };
}

async function attachPaymentDueAtProjection(
  tx: Prisma.TransactionClient,
  tenantId: string,
  records: readonly BookingRecord[]
): Promise<BookingRecord[]> {
  const registrationIds = [
    ...new Set(records.map((record) => record.id.trim()).filter((id) => id.length > 0)),
  ];
  if (registrationIds.length === 0) {
    return [...records];
  }
  const holds = await tx.financePaymentHold.findMany({
    where: {
      tenantId,
      registrationId: { in: registrationIds },
      status: "open",
    },
    select: { registrationId: true, dueAt: true },
  });
  const dueAtByRegistrationId = new Map(
    holds.map((hold) => [hold.registrationId, hold.dueAt.toISOString()] as const)
  );
  return records.map((record) => {
    const paymentDueAt = dueAtByRegistrationId.get(record.id);
    return paymentDueAt === undefined ? record : { ...record, paymentDueAt };
  });
}

function buildBookingListWhere(
  input: Omit<BookingListPageInput, "limit" | "cursor">
): Prisma.OperatorRegistrationWhereInput {
  const q = normalizeBookingSearchQuery(input.q);
  const departureFrom =
    input.departureFrom !== undefined ? new Date(input.departureFrom) : undefined;
  const departureTo = input.departureTo !== undefined ? new Date(input.departureTo) : undefined;
  const hasDepartureFrom = departureFrom !== undefined && !Number.isNaN(departureFrom.getTime());
  const hasDepartureTo = departureTo !== undefined && !Number.isNaN(departureTo.getTime());
  const approvedFrom = input.approvedFrom !== undefined ? new Date(input.approvedFrom) : undefined;
  const approvedTo = input.approvedTo !== undefined ? new Date(input.approvedTo) : undefined;
  const hasApprovedFrom = approvedFrom !== undefined && !Number.isNaN(approvedFrom.getTime());
  const hasApprovedTo = approvedTo !== undefined && !Number.isNaN(approvedTo.getTime());

  return {
    tenantId: input.tenantId,
    ...(input.statuses !== undefined && input.statuses.length > 0
      ? {
          status: input.statuses.length === 1 ? input.statuses[0] : { in: [...input.statuses] },
        }
      : input.status !== undefined
        ? { status: input.status }
        : {}),
    ...(input.tourId !== undefined && input.tourId.length > 0 ? { tourId: input.tourId } : {}),
    ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
    ...(input.submittedByUserId !== undefined
      ? { submittedByUserId: input.submittedByUserId }
      : {}),
    ...(hasDepartureFrom || hasDepartureTo
      ? {
          departureAt: {
            ...(hasDepartureFrom ? { gte: departureFrom } : {}),
            ...(hasDepartureTo ? { lt: departureTo } : {}),
          },
        }
      : {}),
    ...(hasApprovedFrom || hasApprovedTo
      ? {
          approvedAt: {
            ...(hasApprovedFrom ? { gte: approvedFrom } : {}),
            ...(hasApprovedTo ? { lt: approvedTo } : {}),
          },
        }
      : {}),
    ...(q !== undefined
      ? (() => {
          const phoneNeedles = new Set<string>([q]);
          for (const pattern of buildIranMobileSearchPatterns(q)) {
            const needle = pattern.replace(/^%|%$/g, "");
            if (needle.length > 0) {
              phoneNeedles.add(needle);
            }
          }
          return {
            OR: [
              { guestLabel: { contains: q, mode: "insensitive" } },
              { guestEmail: { contains: q, mode: "insensitive" } },
              ...[...phoneNeedles].map((needle) => ({
                guestPhone: { contains: needle, mode: "insensitive" as const },
              })),
            ],
          };
        })()
      : {}),
  };
}

function applySubmittedAtKeysetCursor(
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

function applyDepartureAtKeysetCursor(
  baseWhere: Prisma.OperatorRegistrationWhereInput,
  cursor: { departureAt: Date; id: string }
): Prisma.OperatorRegistrationWhereInput {
  return {
    AND: [
      baseWhere,
      {
        OR: [
          { departureAt: { gt: cursor.departureAt } },
          {
            departureAt: cursor.departureAt,
            id: { gt: cursor.id },
          },
        ],
      },
    ],
  };
}

function assertTenantId(tenantId: string): void {
  if (tenantId.trim().length === 0) {
    throw new Error("TENANT_ID_REQUIRED");
  }
}

export class PrismaBookingsRepository implements BookingRepositoryPort {
  /** @deprecated Test/perf baseline — delegates to listByTenantPage (cap 500). */
  async listByTenant(tenantId: string): Promise<BookingRecord[]> {
    const page = await this.listByTenantPage({
      tenantId,
      limit: MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
    });
    return [...page.items];
  }

  async countBookingsBySubmittedUser(tenantId: string, submittedByUserId: string): Promise<number> {
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
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.operatorRegistration.findMany({
        where: { tenantId, submittedByUserId },
        select: BOOKING_LIST_SELECT,
        orderBy: [{ departureAt: "desc" }, { id: "desc" }],
        take: capped,
      });
      return enrichBookingListRecordsWithIntakeScalars(
        tx,
        tenantId,
        rows.map(toBookingListRecord)
      );
    });
  }

  async listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput> {
    const baseWhere = buildBookingListWhere(input);
    const sortMode = input.sort === "departureAt" ? "departureAt" : "submittedAt";

    const { items, hasMore } = await withTenantRls(input.tenantId, async (tx) => {
      let where = baseWhere;

      if (input.cursor !== undefined && input.cursor.length > 0) {
        const cursorRow = await tx.operatorRegistration.findFirst({
          where: { id: input.cursor, tenantId: input.tenantId },
          select: { id: true, submittedAt: true, departureAt: true },
        });
        if (cursorRow !== null) {
          where =
            sortMode === "departureAt"
              ? applyDepartureAtKeysetCursor(baseWhere, {
                  id: cursorRow.id,
                  departureAt: cursorRow.departureAt,
                })
              : applySubmittedAtKeysetCursor(baseWhere, {
                  id: cursorRow.id,
                  submittedAt: cursorRow.submittedAt,
                });
        }
      }

      const rows = await tx.operatorRegistration.findMany({
        where,
        select: BOOKING_LIST_SELECT,
        orderBy:
          sortMode === "departureAt"
            ? [{ departureAt: "asc" }, { id: "asc" }]
            : [{ submittedAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
      });

      const hasMore = rows.length > input.limit;
      const pageRows = rows.slice(0, input.limit);
      const baseItems = await attachPaymentDueAtProjection(
        tx,
        input.tenantId,
        pageRows.map(toBookingListRecord)
      );
      const items = await enrichBookingListRecordsWithIntakeScalars(
        tx,
        input.tenantId,
        baseItems
      );

      return { items, hasMore };
    });

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    };
  }

  async countByTenantFilters(
    input: Omit<BookingListPageInput, "limit" | "cursor">
  ): Promise<number> {
    assertTenantId(input.tenantId);
    const where = buildBookingListWhere(input);
    return withTenantRls(input.tenantId, (tx) => tx.operatorRegistration.count({ where }));
  }

  async findActiveGuestDuplicate(input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly match: {
      readonly kind: "user" | "label" | "email" | "nationalId" | "phone";
      readonly value: string;
    };
  }): Promise<BookingRecord | null> {
    assertTenantId(input.tenantId);
    const raw = input.match.value.trim();
    if (raw.length === 0 || input.tourId.trim().length === 0) {
      return null;
    }
    const activeStatus: Prisma.StringFilter<"OperatorRegistration"> = {
      notIn: ["cancelled", "rejected"],
    };

    return withTenantRls(input.tenantId, async (tx) => {
      let where: Prisma.OperatorRegistrationWhereInput;
      switch (input.match.kind) {
        case "user":
          // Self-only: exclude registrantTarget=other (missing/null target counts as self).
          where = {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: activeStatus,
            submittedByUserId: raw,
            NOT: {
              registrationIntake: {
                path: ["registrantTarget"],
                equals: "other",
              },
            },
          };
          break;
        case "label":
          where = {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: activeStatus,
            guestLabel: { equals: raw, mode: "insensitive" },
          };
          break;
        case "email":
          where = {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: activeStatus,
            guestEmail: { equals: raw, mode: "insensitive" },
          };
          break;
        case "phone": {
          const phoneKeys = resolveLoginMobileLookupKeys(raw);
          where = {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: activeStatus,
            guestPhone: { in: [...phoneKeys], mode: "insensitive" },
          };
          break;
        }
        case "nationalId":
          where = {
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: activeStatus,
            registrationIntake: {
              path: ["nationalId"],
              equals: raw,
            },
          };
          break;
        default: {
          const _exhaustive: never = input.match.kind;
          return _exhaustive;
        }
      }

      const row = await tx.operatorRegistration.findFirst({
        where,
        select: BOOKING_LIST_SELECT,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      });
      if (row === null) {
        return null;
      }
      const [enriched] = await enrichBookingListRecordsWithIntakeScalars(tx, input.tenantId, [
        toBookingListRecord(row),
      ]);
      return enriched ?? null;
    });
  }

  async getBookingsSummaryStats(input: {
    readonly tenantId: string;
    readonly now: Date;
    readonly tourChipScope?: "ops" | "all";
  }): Promise<{
    readonly pending: number;
    readonly approvedToday: number;
    readonly departures7d: number;
    readonly waitlist: number;
    readonly tourChips: readonly {
      readonly tourId: string;
      readonly tourTitle: string;
      readonly pendingCount: number;
      readonly totalCount: number;
    }[];
  }> {
    assertTenantId(input.tenantId);
    const dayStart = new Date(
      Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate())
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const departuresEnd = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return withTenantRls(input.tenantId, async (tx) => {
      const [pending, approvedToday, departures7d, waitlist, chipRows] = await Promise.all([
        tx.operatorRegistration.count({
          where: { tenantId: input.tenantId, status: "pending" },
        }),
        tx.operatorRegistration.count({
          where: {
            tenantId: input.tenantId,
            status: "approved",
            approvedAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        tx.operatorRegistration.count({
          where: {
            tenantId: input.tenantId,
            departureAt: { gte: input.now, lt: departuresEnd },
          },
        }),
        tx.operatorRegistration.count({
          where: { tenantId: input.tenantId, status: "waitlisted" },
        }),
        tx.operatorRegistration.groupBy({
          by: ["tourId"],
          where: { tenantId: input.tenantId },
          _count: { _all: true },
        }),
      ]);
      const chipTourIds = chipRows.map((row) => row.tourId);

      const [pendingByTour, waitlistedByTour, upcomingTourRows, currentTours, fallbackTitleRows] =
        await Promise.all([
          tx.operatorRegistration.groupBy({
            by: ["tourId"],
            where: { tenantId: input.tenantId, status: "pending" },
            _count: { _all: true },
          }),
          tx.operatorRegistration.groupBy({
            by: ["tourId"],
            where: { tenantId: input.tenantId, status: "waitlisted" },
            _count: { _all: true },
          }),
          tx.operatorRegistration.groupBy({
            by: ["tourId"],
            where: {
              tenantId: input.tenantId,
              departureAt: { gte: input.now },
            },
            _count: { _all: true },
          }),
          tx.tour.findMany({
            where: { tenantId: input.tenantId, id: { in: chipTourIds } },
            select: { id: true, title: true },
          }),
          tx.operatorRegistration.groupBy({
            by: ["tourId", "tourTitle"],
            where: { tenantId: input.tenantId, tourId: { in: chipTourIds } },
            _max: { submittedAt: true },
          }),
        ]);
      const pendingMap = new Map(
        pendingByTour.map((row) => [row.tourId, row._count._all] as const)
      );
      const waitlistedMap = new Map(
        waitlistedByTour.map((row) => [row.tourId, row._count._all] as const)
      );
      const upcomingTourIds = new Set(upcomingTourRows.map((row) => row.tourId));
      const currentTourTitleMap = new Map(
        currentTours
          .map((row) => [row.id, row.title?.trim() ?? ""] as const)
          .filter(([, title]) => title.length > 0)
      );
      const fallbackTourTitleMap = new Map<string, string>();
      const latestFallbackTitleRows = [...fallbackTitleRows].sort((left, right) => {
        const leftTime = left._max.submittedAt?.getTime() ?? 0;
        const rightTime = right._max.submittedAt?.getTime() ?? 0;
        return rightTime - leftTime;
      });
      for (const row of latestFallbackTitleRows) {
        if (!fallbackTourTitleMap.has(row.tourId) && row.tourTitle.trim().length > 0) {
          fallbackTourTitleMap.set(row.tourId, row.tourTitle);
        }
      }

      const tourChips = finalizeBookingTourChips(
        chipRows.map((row) => ({
          tourId: row.tourId,
          tourTitle:
            currentTourTitleMap.get(row.tourId) ??
            fallbackTourTitleMap.get(row.tourId) ??
            row.tourId,
          pendingCount: pendingMap.get(row.tourId) ?? 0,
          totalCount: row._count._all,
          waitlistedCount: waitlistedMap.get(row.tourId) ?? 0,
          hasUpcomingDeparture: upcomingTourIds.has(row.tourId),
        })),
        input.tourChipScope === "all" ? "all" : "ops"
      );

      return { pending, approvedToday, departures7d, waitlist, tourChips };
    });
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
      if (row === null) {
        return null;
      }
      const [record] = await attachPaymentDueAtProjection(tx, tenantId, [toBookingRecord(row)]);
      return record ?? null;
    });
  }

  async getByIds(ids: readonly string[], tenantId: string): Promise<BookingRecord[]> {
    assertTenantId(tenantId);
    const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
    if (unique.length === 0) {
      return [];
    }
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.operatorRegistration.findMany({
        where: { tenantId, id: { in: unique } },
        select: BOOKING_LIST_SELECT,
      });
      const enriched = await enrichBookingListRecordsWithIntakeScalars(
        tx,
        tenantId,
        rows.map(toBookingListRecord)
      );
      return attachPaymentDueAtProjection(tx, tenantId, enriched);
    });
  }

  async updatePaymentStatus(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly paymentStatus: BookingPaymentStatus;
  }): Promise<BookingRecord | null> {
    assertTenantId(input.tenantId);
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
        select: BOOKING_LIST_SELECT,
      });
      if (existing === null) {
        return null;
      }
      const current = existing.paymentStatus as BookingPaymentStatus;
      const next = raiseBookingPaymentStatus(current, input.paymentStatus);
      if (next === current) {
        const [enriched] = await enrichBookingListRecordsWithIntakeScalars(
          tx,
          input.tenantId,
          [toBookingListRecord(existing)]
        );
        return enriched ?? null;
      }
      const updated = await tx.operatorRegistration.updateMany({
        where: { id: input.bookingId, tenantId: input.tenantId },
        data: { paymentStatus: next },
      });
      if (updated.count !== 1) {
        return null;
      }
      const row = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
        select: BOOKING_LIST_SELECT,
      });
      if (row === null) {
        return null;
      }
      const [enriched] = await enrichBookingListRecordsWithIntakeScalars(tx, input.tenantId, [
        toBookingListRecord(row),
      ]);
      return enriched ?? null;
    });
  }

  async mergeRegistrationIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly patch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null> {
    assertTenantId(input.tenantId);
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (existing === null) {
        return null;
      }
      const currentIntake =
        existing.registrationIntake !== null &&
        typeof existing.registrationIntake === "object" &&
        !Array.isArray(existing.registrationIntake)
          ? (existing.registrationIntake as Record<string, unknown>)
          : {};
      const nextIntake = { ...currentIntake, ...input.patch };
      const updated = await tx.operatorRegistration.updateMany({
        where: { id: input.bookingId, tenantId: input.tenantId },
        data: { registrationIntake: nextIntake as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) {
        return null;
      }
      const row = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      return row === null ? null : toBookingRecord(row);
    });
  }

  async updateGuestProjectionAndIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string | null;
    readonly guestPhone?: string | null;
    readonly intakePatch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null> {
    assertTenantId(input.tenantId);
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (existing === null) {
        return null;
      }
      const currentIntake =
        existing.registrationIntake !== null &&
        typeof existing.registrationIntake === "object" &&
        !Array.isArray(existing.registrationIntake)
          ? (existing.registrationIntake as Record<string, unknown>)
          : {};
      const nextIntake = { ...currentIntake, ...input.intakePatch };
      const updated = await tx.operatorRegistration.updateMany({
        where: { id: input.bookingId, tenantId: input.tenantId },
        data: {
          guestLabel: input.guestLabel,
          ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
          ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
          registrationIntake: nextIntake as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) {
        return null;
      }
      const row = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      return row === null ? null : toBookingRecord(row);
    });
  }

  async reclassifyOwnedOtherToSelf(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly submittedByUserId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string | null;
    readonly guestPhone?: string | null;
    readonly intakePatch: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly id: string; readonly status: string } | null> {
    assertTenantId(input.tenantId);
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.operatorRegistration.findFirst({
        where: {
          id: input.bookingId,
          tenantId: input.tenantId,
          submittedByUserId: input.submittedByUserId,
          status: { notIn: ["cancelled", "rejected"] },
          registrationIntake: {
            path: ["registrantTarget"],
            equals: "other",
          },
        },
        select: {
          id: true,
          status: true,
          registrationIntake: true,
        },
      });
      if (existing === null) {
        return null;
      }
      const currentIntake =
        existing.registrationIntake !== null &&
        typeof existing.registrationIntake === "object" &&
        !Array.isArray(existing.registrationIntake)
          ? (existing.registrationIntake as Record<string, unknown>)
          : {};
      const nextIntake = { ...currentIntake, ...input.intakePatch };
      const updated = await tx.operatorRegistration.updateMany({
        where: { id: input.bookingId, tenantId: input.tenantId },
        data: {
          guestLabel: input.guestLabel,
          ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
          ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
          registrationIntake: nextIntake as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) {
        return null;
      }
      return { id: existing.id, status: existing.status };
    });
  }

  async createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
    assertCapacityInTx?: (ctx: {
      readonly tourId: string;
      readonly partySize: number;
      readonly occupiedApprovedPartySize: number;
    }) => void;
  }): Promise<BookingRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      await acquireTourCapacityLock(tx, input.tenantId, input.body.tourId);
      const occupiedApprovedPartySize = await sumApprovedPartySizeInTx(
        tx,
        input.tenantId,
        input.body.tourId
      );
      if (input.assertCapacityInTx !== undefined) {
        await Promise.resolve(
          input.assertCapacityInTx({
            tourId: input.body.tourId,
            partySize: input.body.partySize,
            occupiedApprovedPartySize,
          })
        );
      }
      const row = await tx.operatorRegistration
        .create({
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
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("BOOKING_GUEST_DUPLICATE");
          }
          throw error;
        });
      return toBookingRecord(row);
    });
  }

  async approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
    assertCapacityInTx?: (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
    }) => void;
  }): Promise<BookingRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const preliminary = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (preliminary === null) {
        throw new BookingNotFoundError();
      }

      await acquireTourCapacityLock(tx, input.tenantId, preliminary.tourId);

      const current = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (current === null) {
        throw new BookingNotFoundError();
      }
      if (!canTransitionBookingStatus(current.status as BookingStatus, "approved")) {
        throw new BookingStatusConflictError(current.status as BookingStatus);
      }

      const occupiedApprovedPartySize = await sumApprovedPartySizeInTx(
        tx,
        input.tenantId,
        current.tourId
      );
      if (input.assertCapacityInTx !== undefined) {
        await Promise.resolve(
          input.assertCapacityInTx({
            booking: toBookingRecord(current),
            occupiedApprovedPartySize,
          })
        );
      }

      const approvedAt = new Date();
      const transitioned = await tx.operatorRegistration.updateMany({
        where: {
          id: current.id,
          tenantId: input.tenantId,
          status: { in: [...listBookingSourceStatusesForTarget("approved")] },
        },
        data: { status: "approved", approvedAt },
      });
      if (transitioned.count !== 1) {
        const again = await tx.operatorRegistration.findFirst({
          where: { id: current.id, tenantId: input.tenantId },
        });
        if (again === null) {
          throw new BookingNotFoundError();
        }
        throw new BookingStatusConflictError(again.status as BookingStatus);
      }

      const updated = await tx.operatorRegistration.findFirstOrThrow({
        where: { id: current.id, tenantId: input.tenantId },
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
    assertCapacityInTx?: (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
    }) => void;
  }): Promise<BookingRecord[]> {
    if (input.ids.length > input.maxBatch) {
      throw new BulkApproveBatchLimitError(input.maxBatch);
    }

    return withTenantRls(input.tenantId, async (tx) => {
      const rows = await tx.operatorRegistration.findMany({
        where: { tenantId: input.tenantId, id: { in: [...input.ids] } },
        take: input.ids.length,
      });
      const eligiblePreview = rows.filter((row) =>
        canTransitionBookingStatus(row.status as BookingStatus, "approved")
      );
      if (eligiblePreview.length === 0) {
        return [];
      }

      // Sorted lock order — prevent AB-BA deadlock across concurrent bulk TXs.
      const tourIds = [...new Set(eligiblePreview.map((row) => row.tourId))].sort();
      for (const tourId of tourIds) {
        await acquireTourCapacityLock(tx, input.tenantId, tourId);
      }

      const approvedAt = new Date();
      const approvedIds: string[] = [];
      const runningOccupied = new Map<string, number>();

      for (const preview of eligiblePreview) {
        const row = await tx.operatorRegistration.findFirst({
          where: { id: preview.id, tenantId: input.tenantId },
        });
        if (row === null) {
          continue;
        }
        if (!canTransitionBookingStatus(row.status as BookingStatus, "approved")) {
          continue;
        }

        let occupied = runningOccupied.get(row.tourId);
        if (occupied === undefined) {
          occupied = await sumApprovedPartySizeInTx(tx, input.tenantId, row.tourId);
        }
        if (input.assertCapacityInTx !== undefined) {
          try {
            await Promise.resolve(
              input.assertCapacityInTx({
                booking: toBookingRecord(row),
                occupiedApprovedPartySize: occupied,
              })
            );
          } catch (error) {
            // Bulk must fill up to capacity then skip — throwing would ROLLBACK winners.
            if (error instanceof Error && error.message.startsWith("BOOKING_CAPACITY_REJECTED")) {
              continue;
            }
            throw error;
          }
        }
        const transitioned = await tx.operatorRegistration.updateMany({
          where: {
            id: row.id,
            tenantId: input.tenantId,
            status: { in: [...listBookingSourceStatusesForTarget("approved")] },
          },
          data: { status: "approved", approvedAt },
        });
        if (transitioned.count !== 1) {
          continue;
        }
        runningOccupied.set(row.tourId, occupied + row.partySize);
        approvedIds.push(row.id);

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

      if (approvedIds.length === 0) {
        return [];
      }
      const updated = await tx.operatorRegistration.findMany({
        where: {
          tenantId: input.tenantId,
          id: { in: approvedIds },
        },
        take: approvedIds.length,
      });
      return updated.map((row) => toBookingRecord(row));
    });
  }

  /**
   * pending|waitlisted → rejected. Persist status + optional rejectReason — no outbox (decision B).
   * Tour lock + conditional update — cannot overwrite concurrent approve.
   */
  async rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord> {
    const rejectReason =
      input.reason !== undefined && input.reason.trim().length > 0
        ? input.reason.trim()
        : undefined;
    return withTenantRls(input.tenantId, async (tx) => {
      const preliminary = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (preliminary === null) {
        throw new BookingNotFoundError();
      }
      await acquireTourCapacityLock(tx, input.tenantId, preliminary.tourId);

      const transitioned = await tx.operatorRegistration.updateMany({
        where: {
          id: input.bookingId,
          tenantId: input.tenantId,
          status: { in: [...listBookingSourceStatusesForTarget("rejected")] },
        },
        data: {
          status: "rejected",
          approvedAt: null,
          ...(rejectReason !== undefined ? { rejectReason } : {}),
        },
      });
      if (transitioned.count !== 1) {
        const again = await tx.operatorRegistration.findFirst({
          where: { id: input.bookingId, tenantId: input.tenantId },
        });
        if (again === null) {
          throw new BookingNotFoundError();
        }
        throw new BookingStatusConflictError(again.status as BookingStatus);
      }
      const updated = await tx.operatorRegistration.findFirstOrThrow({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      return toBookingRecord(updated);
    });
  }

  async waitlistBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
  }): Promise<BookingRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const preliminary = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (preliminary === null) {
        throw new BookingNotFoundError();
      }
      await acquireTourCapacityLock(tx, input.tenantId, preliminary.tourId);

      const waitlistedAt = new Date();
      const transitioned = await tx.operatorRegistration.updateMany({
        where: {
          id: input.bookingId,
          tenantId: input.tenantId,
          status: { in: [...listBookingSourceStatusesForTarget("waitlisted")] },
        },
        data: { status: "waitlisted", approvedAt: null },
      });
      if (transitioned.count !== 1) {
        const again = await tx.operatorRegistration.findFirst({
          where: { id: input.bookingId, tenantId: input.tenantId },
        });
        if (again === null) {
          throw new BookingNotFoundError();
        }
        throw new BookingStatusConflictError(again.status as BookingStatus);
      }
      const updated = await tx.operatorRegistration.findFirstOrThrow({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: updated.id,
        eventType: input.outboxEvent,
        payload: {
          bookingId: updated.id,
          tourId: updated.tourId,
          status: "waitlisted",
          waitlistedAt: waitlistedAt.toISOString(),
        },
        domainEventId: `registration.waitlisted:${updated.id}:${waitlistedAt.toISOString()}`,
        createdAt: waitlistedAt,
      });
      return toBookingRecord(updated);
    });
  }

  async cancelBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
  }): Promise<BookingRecord> {
    return withTenantRls(input.tenantId, async (tx) => {
      const preliminary = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (preliminary === null) {
        throw new BookingNotFoundError();
      }
      await acquireTourCapacityLock(tx, input.tenantId, preliminary.tourId);

      const current = await tx.operatorRegistration.findFirst({
        where: { id: input.bookingId, tenantId: input.tenantId },
      });
      if (current === null) {
        throw new BookingNotFoundError();
      }
      if (!canTransitionBookingStatus(current.status as BookingStatus, "cancelled")) {
        throw new BookingStatusConflictError(current.status as BookingStatus);
      }
      const previousStatus = current.status;
      const cancelledAt = new Date();
      const transitioned = await tx.operatorRegistration.updateMany({
        where: {
          id: current.id,
          tenantId: input.tenantId,
          status: { in: [...listBookingSourceStatusesForTarget("cancelled")] },
        },
        data: { status: "cancelled", approvedAt: null },
      });
      if (transitioned.count !== 1) {
        const again = await tx.operatorRegistration.findFirst({
          where: { id: current.id, tenantId: input.tenantId },
        });
        if (again === null) {
          throw new BookingNotFoundError();
        }
        throw new BookingStatusConflictError(again.status as BookingStatus);
      }
      const updated = await tx.operatorRegistration.findFirstOrThrow({
        where: { id: current.id, tenantId: input.tenantId },
      });
      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: updated.id,
        eventType: input.outboxEvent,
        payload: {
          bookingId: updated.id,
          tourId: updated.tourId,
          status: "cancelled",
          cancelledAt: cancelledAt.toISOString(),
          previousStatus,
        },
        domainEventId: `registration.cancelled:${updated.id}:${cancelledAt.toISOString()}`,
        createdAt: cancelledAt,
      });
      return toBookingRecord(updated);
    });
  }

  seedBooking(_record: BookingRecord): void {
    throw new Error("BOOKINGS_SEED_REQUIRES_MEMORY_DRIVER");
  }
}
