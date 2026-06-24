import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { getPrisma, getPrismaAdmin } from "../db/prisma";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import type {
  BookingOutboxRecord,
  BookingRecord,
  BookingStatus,
  CreateBookingRequest,
} from "./bookings.types";
import type { BookingsRepository } from "./in-memory-bookings.repository";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./in-memory-bookings.repository";

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
}): BookingRecord {
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

export class PrismaBookingsRepository implements BookingsRepository {
  async listByTenant(tenantId: string): Promise<BookingRecord[]> {
    const rows = await withTenantRls(tenantId, (tx) =>
      tx.operatorRegistration.findMany({
        where: { tenantId },
        orderBy: { submittedAt: "desc" },
      })
    );
    return rows.map((row) => toBookingRecord(row));
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

  async getById(id: string): Promise<BookingRecord | null> {
    // Primary-key lookup before caller authz (e.g. member receipt) — app pool has NOBYPASSRLS
    // and queries outside withTenantRls see zero rows on Postgres staging.
    const row = await getPrismaAdmin().operatorRegistration.findUnique({ where: { id } });
    if (row === null) {
      return null;
    }
    return toBookingRecord(row);
  }

  async listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]> {
    const booking = await getPrisma().operatorRegistration.findUnique({
      where: { id: aggregateId },
      select: { tenantId: true },
    });
    if (booking === null) {
      return [];
    }
    const rows = await withTenantRls(booking.tenantId, (tx) =>
      tx.outboxEvent.findMany({
        where: { tenantId: booking.tenantId, aggregateId },
        orderBy: { createdAt: "asc" },
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

    const approved: BookingRecord[] = [];
    for (const bookingId of input.ids) {
      try {
        const row = await this.approveWithOutbox({
          bookingId,
          tenantId: input.tenantId,
          outboxEvent: input.outboxEvent,
        });
        approved.push(row);
      } catch (error) {
        if (
          error instanceof BookingNotFoundError ||
          error instanceof BookingStatusConflictError
        ) {
          continue;
        }
        throw error;
      }
    }
    return approved;
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
