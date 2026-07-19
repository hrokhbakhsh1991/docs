import { randomUUID } from "node:crypto";

import {
  compareBookingsBySubmittedAtDesc,
  isBookingAfterKeysetCursor,
  matchesBookingListFilters,
  startOfUtcDay,
} from "./booking-list-query";
import type {
  ActiveDuplicateByEmailInput,
  ActiveDuplicateByGuestLabelInput,
  ActiveDuplicateByNationalIdInput,
  ActiveDuplicateByUserInput,
  BookingListPageInput,
  BookingListPageOutput,
  BookingOutboxRecord,
  BookingPaymentStatus,
  BookingRecord,
  BookingTourChip,
  BookingsSummaryCounts,
  CreateBookingRequest,
} from "./bookings.types";
import {
  isActiveDuplicateBookingStatus,
  readRegistrationIntakeNationalId,
} from "./booking-active-duplicate";
import { MAX_OUTBOX_EVENTS_PER_AGGREGATE } from "./bookings-outbox-projection";
import {
  CANCELLED_BOOKING_STATUSES,
  MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
  MAX_MEMBER_BOOKINGS_LIST_CAP,
} from "./bookings-member-summary-projection";
import { raiseBookingPaymentStatus } from "./booking-payment-status";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";

export type { BookingRepositoryPort, BookingsRepository } from "./ports/booking-repository.port";
export {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";

type RepositorySnapshot = {
  readonly bookings: Map<string, BookingRecord>;
  readonly outbox: BookingOutboxRecord[];
};

let bookingsStore = new Map<string, BookingRecord>();
let outboxStore: BookingOutboxRecord[] = [];
let _devFixtureSeeded = false;

/** Phase 9.8 smoke — mirrors `operator-bookings-fixture.ts` for memory API boot. */
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PENDING_BOOKING_ID = "00000000-0000-4000-8000-000000000310";
const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const OPERATOR_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";

function seedOperatorSmokeDevBookingsFixture(): void {
  if (_devFixtureSeeded) {
    return;
  }
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
  _devFixtureSeeded = true;
}

function cloneBooking(record: BookingRecord): BookingRecord {
  return { ...record };
}

function toBookingListRecord(record: BookingRecord): BookingRecord {
  const { registrationIntake: _omit, ...listRecord } = record;
  return listRecord;
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
  _devFixtureSeeded = false;
}

export class InMemoryBookingsRepository implements BookingRepositoryPort {
  static createWithDevSeed(): InMemoryBookingsRepository {
    seedOperatorSmokeDevBookingsFixture();
    return new InMemoryBookingsRepository();
  }

  seedBooking(record: BookingRecord): void {
    bookingsStore.set(record.id, cloneBooking(record));
  }

  async listByTenant(tenantId: string): Promise<BookingRecord[]> {
    return [...bookingsStore.values()]
      .filter((row) => row.tenantId === tenantId)
      .sort(compareBookingsBySubmittedAtDesc)
      .slice(0, MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED)
      .map(cloneBooking);
  }

  private memberBookingsForUser(tenantId: string, submittedByUserId: string): BookingRecord[] {
    return [...bookingsStore.values()].filter(
      (row) => row.tenantId === tenantId && row.submittedByUserId === submittedByUserId
    );
  }

  async listBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<BookingRecord[]> {
    return this.memberBookingsForUser(tenantId, submittedByUserId)
      .sort(
        (left, right) =>
          new Date(right.departureAt).getTime() - new Date(left.departureAt).getTime() ||
          right.id.localeCompare(left.id)
      )
      .slice(0, MAX_MEMBER_BOOKINGS_LIST_CAP)
      .map(toBookingListRecord);
  }

  async countBookingsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<number> {
    return this.memberBookingsForUser(tenantId, submittedByUserId).length;
  }

  async countCancelledBookingsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<number> {
    const cancelled = new Set<string>(CANCELLED_BOOKING_STATUSES);
    return this.memberBookingsForUser(tenantId, submittedByUserId).filter((row) =>
      cancelled.has(row.status)
    ).length;
  }

  async countCompletedTripsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    now: Date
  ): Promise<number> {
    const cancelled = new Set<string>(CANCELLED_BOOKING_STATUSES);
    return this.memberBookingsForUser(tenantId, submittedByUserId).filter((row) => {
      if (cancelled.has(row.status)) {
        return false;
      }
      const departure = new Date(row.departureAt);
      return !Number.isNaN(departure.getTime()) && departure.getTime() < now.getTime();
    }).length;
  }

  async listRecentBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    limit: number
  ): Promise<BookingRecord[]> {
    const capped = Math.min(Math.max(limit, 1), MAX_MEMBER_BOOKINGS_LIST_CAP);
    return this.memberBookingsForUser(tenantId, submittedByUserId)
      .sort(
        (left, right) =>
          new Date(right.departureAt).getTime() - new Date(left.departureAt).getTime() ||
          right.id.localeCompare(left.id)
      )
      .slice(0, capped)
      .map(toBookingListRecord);
  }

  async findActiveDuplicateByUser(
    input: ActiveDuplicateByUserInput
  ): Promise<BookingRecord | null> {
    const normalizedUserId = input.submittedByUserId.trim();
    if (normalizedUserId.length === 0) {
      return null;
    }
    const hit = [...bookingsStore.values()].find(
      (row) =>
        row.tenantId === input.tenantId &&
        row.tourId === input.tourId &&
        isActiveDuplicateBookingStatus(row.status) &&
        row.submittedByUserId === normalizedUserId
    );
    return hit === undefined ? null : cloneBooking(hit);
  }

  async findActiveDuplicateByGuestLabel(
    input: ActiveDuplicateByGuestLabelInput
  ): Promise<BookingRecord | null> {
    const normalizedLabel = input.guestLabel.trim().toLocaleLowerCase();
    if (normalizedLabel.length === 0) {
      return null;
    }
    const hit = [...bookingsStore.values()].find(
      (row) =>
        row.tenantId === input.tenantId &&
        row.tourId === input.tourId &&
        isActiveDuplicateBookingStatus(row.status) &&
        row.guestLabel.trim().toLocaleLowerCase() === normalizedLabel
    );
    return hit === undefined ? null : cloneBooking(hit);
  }

  async findActiveDuplicateByEmail(
    input: ActiveDuplicateByEmailInput
  ): Promise<BookingRecord | null> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail.length === 0) {
      return null;
    }
    const hit = [...bookingsStore.values()].find(
      (row) =>
        row.tenantId === input.tenantId &&
        row.tourId === input.tourId &&
        isActiveDuplicateBookingStatus(row.status) &&
        (row.guestEmail?.trim().toLowerCase() ?? "") === normalizedEmail
    );
    return hit === undefined ? null : cloneBooking(hit);
  }

  async findActiveDuplicateByNationalId(
    input: ActiveDuplicateByNationalIdInput
  ): Promise<BookingRecord | null> {
    const normalizedNationalId = input.nationalId.trim();
    if (normalizedNationalId.length === 0) {
      return null;
    }
    const hit = [...bookingsStore.values()].find(
      (row) =>
        row.tenantId === input.tenantId &&
        row.tourId === input.tourId &&
        isActiveDuplicateBookingStatus(row.status) &&
        readRegistrationIntakeNationalId(row.registrationIntake) === normalizedNationalId
    );
    return hit === undefined ? null : cloneBooking(hit);
  }

  async listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput> {
    let rows = [...bookingsStore.values()].filter((row) => row.tenantId === input.tenantId);
    rows = rows.filter((row) => matchesBookingListFilters(row, input));

    if (input.cursor !== undefined && input.cursor.length > 0) {
      const cursorRow = bookingsStore.get(input.cursor);
      if (cursorRow !== undefined && cursorRow.tenantId === input.tenantId) {
        rows = rows.filter((row) =>
          isBookingAfterKeysetCursor(row, {
            submittedAt: cursorRow.submittedAt,
            id: cursorRow.id,
          })
        );
      }
    }

    rows.sort(compareBookingsBySubmittedAtDesc);

    const pageRows = rows.slice(0, input.limit + 1);
    const hasMore = pageRows.length > input.limit;
    const items = pageRows.slice(0, input.limit).map(toBookingListRecord);

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    };
  }

  async countByListFilters(
    input: Omit<BookingListPageInput, "limit" | "cursor">
  ): Promise<number> {
    return [...bookingsStore.values()].filter(
      (row) => row.tenantId === input.tenantId && matchesBookingListFilters(row, input)
    ).length;
  }

  async getBookingsSummaryCounts(tenantId: string, now: Date): Promise<BookingsSummaryCounts> {
    const rows = [...bookingsStore.values()].filter((row) => row.tenantId === tenantId);
    const dayStart = startOfUtcDay(now);
    const departuresEnd = new Date(now);
    departuresEnd.setUTCDate(departuresEnd.getUTCDate() + 7);

    return {
      pending: rows.filter((row) => row.status === "pending").length,
      waitlist: rows.filter((row) => row.status === "waitlisted").length,
      approvedToday: rows.filter((row) => {
        if (row.status !== "approved" || row.approvedAt === null) {
          return false;
        }
        return new Date(row.approvedAt) >= dayStart;
      }).length,
      departures7d: rows.filter((row) => {
        const departure = new Date(row.departureAt);
        return departure >= now && departure <= departuresEnd;
      }).length,
    };
  }

  async listTourChipsByTenant(tenantId: string): Promise<readonly BookingTourChip[]> {
    const rows = [...bookingsStore.values()].filter((row) => row.tenantId === tenantId);
    const byTour = new Map<string, BookingTourChip>();
    for (const row of rows) {
      const existing = byTour.get(row.tourId);
      if (existing === undefined) {
        byTour.set(row.tourId, {
          tourId: row.tourId,
          tourTitle: row.tourTitle,
          pendingCount: row.status === "pending" ? 1 : 0,
          totalCount: 1,
        });
        continue;
      }
      byTour.set(row.tourId, {
        ...existing,
        pendingCount: existing.pendingCount + (row.status === "pending" ? 1 : 0),
        totalCount: existing.totalCount + 1,
      });
    }
    return [...byTour.values()].sort((left, right) => right.pendingCount - left.pendingCount);
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

  async getById(id: string, tenantId: string): Promise<BookingRecord | null> {
    const row = bookingsStore.get(id);
    if (row === undefined || row.tenantId !== tenantId) {
      return null;
    }
    return cloneBooking(row);
  }

  async getByIds(ids: readonly string[], tenantId: string): Promise<BookingRecord[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
    const out: BookingRecord[] = [];
    for (const id of unique) {
      const row = await this.getById(id, tenantId);
      if (row !== null) {
        out.push(row);
      }
    }
    return out;
  }

  async updatePaymentStatus(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly paymentStatus: BookingPaymentStatus;
  }): Promise<BookingRecord | null> {
    const row = bookingsStore.get(input.bookingId);
    if (row === undefined || row.tenantId !== input.tenantId) {
      return null;
    }
    const next = raiseBookingPaymentStatus(row.paymentStatus, input.paymentStatus);
    if (next === row.paymentStatus) {
      return cloneBooking(row);
    }
    const updated: BookingRecord = { ...row, paymentStatus: next };
    bookingsStore.set(input.bookingId, updated);
    return cloneBooking(updated);
  }

  async listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]> {
    const rows = outboxStore
      .filter((row) => row.aggregateId === aggregateId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rows.slice(0, MAX_OUTBOX_EVENTS_PER_AGGREGATE).map((row) => ({ ...row }));
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
      ...(input.body.registrationIntake !== undefined
        ? { registrationIntake: input.body.registrationIntake }
        : {}),
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
