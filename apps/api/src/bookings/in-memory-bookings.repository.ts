import { randomUUID } from "node:crypto";

import type {
  BookingOutboxRecord,
  BookingRecord,
  BookingStatus,
  CreateBookingRequest,
} from "./bookings.types";

type RepositorySnapshot = {
  readonly bookings: Map<string, BookingRecord>;
  readonly outbox: BookingOutboxRecord[];
};

let bookingsStore = new Map<string, BookingRecord>();
let outboxStore: BookingOutboxRecord[] = [];
let devFixtureSeeded = false;

/** Phase 9.8 smoke — mirrors `operator-bookings-fixture.ts` for memory API boot. */
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PENDING_BOOKING_ID = "00000000-0000-4000-8000-000000000310";
const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const OPERATOR_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";

function seedOperatorSmokeDevBookingsFixture(): void {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const inFiveDays = new Date(now);
  inFiveDays.setUTCDate(inFiveDays.getUTCDate() + 5);
  const repo = new InMemoryBookingsRepository();

  repo.seedBooking({
    id: OPERATOR_SMOKE_PENDING_BOOKING_ID,
    tenantId: OPERATOR_SMOKE_TENANT_ID,
    tourId: OPERATOR_SMOKE_SEED_TOUR_ID,
    tourTitle: "North Ridge Trek",
    guestLabel: "Ali Rezaei",
    guestEmail: "ali@example.com",
    guestPhone: "+15550002001",
    partySize: 2,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: inFiveDays.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE_MEMBER_USER_ID,
    approvedAt: null,
  });

  repo.seedBooking({
    id: "00000000-0000-4000-8000-000000000311",
    tenantId: OPERATOR_SMOKE_TENANT_ID,
    tourId: "00000000-0000-4000-8000-000000000211",
    tourTitle: "Desert Crossing",
    guestLabel: "Sara Ahmadi",
    guestEmail: "sara@example.com",
    guestPhone: "+15550002002",
    partySize: 1,
    status: "approved",
    paymentStatus: "paid",
    departureAt: tomorrow.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE_MEMBER_USER_ID,
    approvedAt: now.toISOString(),
  });

  repo.seedBooking({
    id: "00000000-0000-4000-8000-000000000312",
    tenantId: OPERATOR_SMOKE_TENANT_ID,
    tourId: OPERATOR_SMOKE_SEED_TOUR_ID,
    tourTitle: "Coastal Walk",
    guestLabel: "Jamal Hosseini",
    guestEmail: null,
    guestPhone: "+15550002003",
    partySize: 3,
    status: "waitlisted",
    paymentStatus: "partial",
    departureAt: inFiveDays.toISOString(),
    submittedAt: now.toISOString(),
    submittedByUserId: OPERATOR_SMOKE_OWNER_USER_ID,
    approvedAt: null,
  });
  devFixtureSeeded = true;
}

function cloneBooking(record: BookingRecord): BookingRecord {
  return { ...record };
}

function snapshotState(): RepositorySnapshot {
  return {
    bookings: new Map(bookingsStore),
    outbox: [...outboxStore],
  };
}

function restoreState(snapshot: RepositorySnapshot): void {
  bookingsStore = new Map(snapshot.bookings);
  outboxStore = [...snapshot.outbox];
}

export function resetBookingsStoresForTests(): void {
  bookingsStore = new Map();
  outboxStore = [];
  devFixtureSeeded = false;
}

export type BookingsRepository = {
  listByTenant(tenantId: string): Promise<BookingRecord[]>;
  sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>>;
  getById(id: string): Promise<BookingRecord | null>;
  listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]>;
  createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
  }): Promise<BookingRecord>;
  approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
  }): Promise<BookingRecord>;
  bulkApproveWithOutbox(input: {
    ids: readonly string[];
    tenantId: string;
    outboxEvent: string;
    maxBatch: number;
  }): Promise<BookingRecord[]>;
  rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord>;
  seedBooking(record: BookingRecord): void;
};

export class InMemoryBookingsRepository implements BookingsRepository {
  static createWithDevSeed(): InMemoryBookingsRepository {
    seedOperatorSmokeDevBookingsFixture();
    return new InMemoryBookingsRepository();
  }

  seedBooking(record: BookingRecord): void {
    bookingsStore.set(record.id, cloneBooking(record));
  }

  async listByTenant(tenantId: string): Promise<BookingRecord[]> {
    return [...bookingsStore.values()].filter((row) => row.tenantId === tenantId);
  }

  async sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>> {
    if (tourIds.length === 0) {
      return {};
    }
    const tourIdSet = new Set(tourIds);
    const totals: Record<string, number> = {};
    for (const row of bookingsStore.values()) {
      if (
        row.tenantId !== tenantId ||
        row.status !== "approved" ||
        !tourIdSet.has(row.tourId)
      ) {
        continue;
      }
      totals[row.tourId] = (totals[row.tourId] ?? 0) + row.partySize;
    }
    return totals;
  }

  async getById(id: string): Promise<BookingRecord | null> {
    const row = bookingsStore.get(id);
    return row === undefined ? null : cloneBooking(row);
  }

  async listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]> {
    return outboxStore.filter((row) => row.aggregateId === aggregateId);
  }

  async createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
  }): Promise<BookingRecord> {
    const now = new Date().toISOString();
    const record: BookingRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      tourId: input.body.tourId,
      tourTitle: input.body.tourTitle,
      guestLabel: input.body.guestLabel,
      guestEmail: input.body.guestEmail ?? null,
      guestPhone: input.body.guestPhone ?? null,
      partySize: input.body.partySize,
      status: "pending",
      paymentStatus: input.body.paymentStatus ?? "unpaid",
      departureAt: input.body.departureAt,
      submittedAt: now,
      submittedByUserId: input.submittedByUserId,
      approvedAt: null,
    };
    bookingsStore.set(record.id, record);
    return cloneBooking(record);
  }

  async approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
  }): Promise<BookingRecord> {
    const before = snapshotState();
    try {
      const current = bookingsStore.get(input.bookingId);
      if (current === undefined || current.tenantId !== input.tenantId) {
        throw new BookingNotFoundError();
      }
      if (current.status !== "pending" && current.status !== "waitlisted") {
        throw new BookingStatusConflictError(current.status);
      }

      const approvedAt = new Date().toISOString();
      const updated: BookingRecord = {
        ...current,
        status: "approved",
        approvedAt,
      };
      bookingsStore.set(updated.id, updated);

      const domainEventId = `registration.approved:${updated.id}:${approvedAt}`;
      outboxStore.push({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: updated.id,
        eventType: input.outboxEvent,
        payload: {
          bookingId: updated.id,
          tourId: updated.tourId,
          status: updated.status,
          approvedAt,
          ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        },
        domainEventId,
        createdAt: approvedAt,
      });

      return cloneBooking(updated);
    } catch (error) {
      restoreState(before);
      throw error;
    }
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

    const before = snapshotState();
    try {
      const approved: BookingRecord[] = [];
      for (const bookingId of input.ids) {
        const current = bookingsStore.get(bookingId);
        if (current === undefined || current.tenantId !== input.tenantId) {
          continue;
        }
        if (current.status !== "pending" && current.status !== "waitlisted") {
          continue;
        }

        const approvedAt = new Date().toISOString();
        const updated: BookingRecord = {
          ...current,
          status: "approved",
          approvedAt,
        };
        bookingsStore.set(updated.id, updated);
        outboxStore.push({
          id: randomUUID(),
          tenantId: input.tenantId,
          aggregateType: "registration",
          aggregateId: updated.id,
          eventType: input.outboxEvent,
          payload: {
            bookingId: updated.id,
            tourId: updated.tourId,
            status: updated.status,
            approvedAt,
          },
          domainEventId: `registration.approved:${updated.id}:${approvedAt}`,
          createdAt: approvedAt,
        });
        approved.push(cloneBooking(updated));
      }
      return approved;
    } catch (error) {
      restoreState(before);
      throw error;
    }
  }

  async rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord> {
    const current = bookingsStore.get(input.bookingId);
    if (current === undefined || current.tenantId !== input.tenantId) {
      throw new BookingNotFoundError();
    }
    if (current.status !== "pending" && current.status !== "waitlisted") {
      throw new BookingStatusConflictError(current.status);
    }
    const updated: BookingRecord = {
      ...current,
      status: "rejected",
      approvedAt: null,
    };
    bookingsStore.set(updated.id, updated);
    return cloneBooking(updated);
  }
}

export class BookingNotFoundError extends Error {
  readonly code = "BOOKING_NOT_FOUND" as const;

  constructor() {
    super("BOOKING_NOT_FOUND");
    this.name = "BookingNotFoundError";
  }
}

export class BulkApproveBatchLimitError extends Error {
  readonly code = "BULK_APPROVE_BATCH_LIMIT" as const;

  constructor(readonly maxBatch: number) {
    super(`BULK_APPROVE_BATCH_LIMIT:${maxBatch}`);
    this.name = "BulkApproveBatchLimitError";
  }
}

export class BookingStatusConflictError extends Error {
  readonly code = "BOOKING_STATUS_CONFLICT" as const;

  constructor(readonly status: BookingStatus) {
    super(`BOOKING_STATUS_CONFLICT:${status}`);
    this.name = "BookingStatusConflictError";
  }
}
