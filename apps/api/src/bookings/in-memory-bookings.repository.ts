import { randomUUID } from "node:crypto";

import { canTransitionBookingStatus } from "./booking-status-transitions";

import {
  compareBookingsByDepartureAtAsc,
  compareBookingsBySubmittedAtDesc,
  isBookingAfterDepartureKeysetCursor,
  isBookingAfterKeysetCursor,
  matchesBookingListFilters,
  resolveBookingListSortMode,
} from "./booking-list-query";
import type {
  BookingListPageInput,
  BookingListPageOutput,
  BookingOutboxRecord,
  BookingPaymentStatus,
  BookingRecord,
  CreateBookingRequest,
} from "./bookings.types";
import { MAX_OUTBOX_EVENTS_PER_AGGREGATE } from "./bookings-outbox-projection";
import {
  CANCELLED_BOOKING_STATUSES,
  MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED,
  MAX_MEMBER_BOOKINGS_LIST_CAP,
} from "./bookings-member-summary-projection";
import { raiseBookingPaymentStatus } from "./booking-payment-status";
import {
  isOwnedActiveOtherReclassifyCandidate,
  readRegistrantTargetFromIntake,
} from "./read-registrant-target";
import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
} from "./read-transport-kind-from-intake";
import {
  enrichInMemoryBookingListRecord,
  resolveFinancialDisplayStateForListRecord,
} from "./booking-list-intake-scalars";
import { finalizeBookingTourChips } from "./booking-tour-chips";
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
/** Serialize memory approve TX so occupancy re-read is race-safe under parallel awaits. */
let approveTxChain: Promise<void> = Promise.resolve();

async function withMemoryApproveTx<T>(fn: () => Promise<T>): Promise<T> {
  const run = approveTxChain.then(fn, fn);
  approveTxChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** DP1-F — shared serial mutation lock for approve/expiry/capture races. */
export async function runSerialBookingMutation<T>(fn: () => Promise<T>): Promise<T> {
  return withMemoryApproveTx(fn);
}

export function appendBookingOutboxEventIfAbsent(input: {
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly domainEventId: string;
}): void {
  if (outboxStore.some((row) => row.domainEventId === input.domainEventId)) {
    return;
  }
  outboxStore.push({
    id: randomUUID(),
    tenantId: input.tenantId,
    aggregateType: "registration",
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload,
    domainEventId: input.domainEventId,
    createdAt: new Date().toISOString(),
  });
}

export function setBookingPaymentDueAtProjection(input: {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly paymentDueAt: string | null;
}): void {
  const current = bookingsStore.get(input.bookingId);
  if (current === undefined || current.tenantId !== input.tenantId) {
    return;
  }
  bookingsStore.set(input.bookingId, { ...current, paymentDueAt: input.paymentDueAt });
}
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
    registrationIntake: { tourCapacityMax: 12 },
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
    registrationIntake: { tourCapacityMax: 12 },
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
    registrationIntake: { tourCapacityMax: 12 },
  });
  _devFixtureSeeded = true;
}

function cloneBooking(record: BookingRecord): BookingRecord {
  const registrationIntake = record.registrationIntake;
  const obligationOverride =
    registrationIntake !== undefined &&
    registrationIntake !== null &&
    typeof registrationIntake.obligationOverride === "object" &&
    registrationIntake.obligationOverride !== null &&
    !Array.isArray(registrationIntake.obligationOverride)
      ? (registrationIntake.obligationOverride as Readonly<Record<string, unknown>>)
      : null;
  return {
    ...record,
    financialDisplayState:
      record.financialDisplayState ??
      resolveFinancialDisplayStateForListRecord(record, obligationOverride),
    registrantTarget: record.registrantTarget ?? readRegistrantTargetFromIntake(registrationIntake),
    transportKind:
      record.transportKind !== undefined
        ? record.transportKind
        : readTransportKindFromIntake(registrationIntake),
    personalCarOccupants:
      record.personalCarOccupants !== undefined
        ? record.personalCarOccupants
        : readPersonalCarOccupantsFromIntake(registrationIntake),
  };
}

/** List projection — strip `registrationIntake` (BK-SAFE-01); keep scalars + WAIVED display. */
function toBookingListRecord(record: BookingRecord): BookingRecord {
  return enrichInMemoryBookingListRecord(record);
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
  approveTxChain = Promise.resolve();
  _devFixtureSeeded = false;
}

/** Test-only outbox peek — not part of BookingRepositoryPort. */
export function peekOutboxByAggregateForTests(input: {
  readonly tenantId: string;
  readonly aggregateId: string;
}): BookingOutboxRecord[] {
  const tenantId = input.tenantId.trim();
  const aggregateId = input.aggregateId.trim();
  if (tenantId.length === 0 || aggregateId.length === 0) {
    return [];
  }
  return outboxStore
    .filter((row) => row.tenantId === tenantId && row.aggregateId === aggregateId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, MAX_OUTBOX_EVENTS_PER_AGGREGATE)
    .map((row) => ({ ...row }));
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

  async countBookingsBySubmittedUser(tenantId: string, submittedByUserId: string): Promise<number> {
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

  async listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput> {
    let rows = [...bookingsStore.values()].filter((row) => row.tenantId === input.tenantId);
    rows = rows.filter((row) => matchesBookingListFilters(row, input));
    const sortMode = resolveBookingListSortMode(input.sort);

    if (input.cursor !== undefined && input.cursor.length > 0) {
      const cursorRow = bookingsStore.get(input.cursor);
      if (cursorRow !== undefined && cursorRow.tenantId === input.tenantId) {
        rows =
          sortMode === "departureAt"
            ? rows.filter((row) =>
                isBookingAfterDepartureKeysetCursor(row, {
                  departureAt: cursorRow.departureAt,
                  id: cursorRow.id,
                })
              )
            : rows.filter((row) =>
                isBookingAfterKeysetCursor(row, {
                  submittedAt: cursorRow.submittedAt,
                  id: cursorRow.id,
                })
              );
      }
    }

    rows.sort(
      sortMode === "departureAt"
        ? compareBookingsByDepartureAtAsc
        : compareBookingsBySubmittedAtDesc
    );

    const pageRows = rows.slice(0, input.limit + 1);
    const hasMore = pageRows.length > input.limit;
    const items = pageRows.slice(0, input.limit).map(toBookingListRecord);

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    };
  }

  async countByTenantFilters(
    input: Omit<BookingListPageInput, "limit" | "cursor">
  ): Promise<number> {
    let rows = [...bookingsStore.values()].filter((row) => row.tenantId === input.tenantId);
    rows = rows.filter((row) => matchesBookingListFilters(row, input));
    return rows.length;
  }

  async findActiveGuestDuplicate(input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly match: {
      readonly kind: "user" | "label" | "email" | "nationalId" | "phone";
      readonly value: string;
    };
  }): Promise<BookingRecord | null> {
    const raw = input.match.value.trim();
    if (raw.length === 0) {
      return null;
    }
    const normalized =
      input.match.kind === "label" || input.match.kind === "email" || input.match.kind === "phone"
        ? raw.toLocaleLowerCase()
        : raw;
    for (const row of bookingsStore.values()) {
      if (
        row.tenantId !== input.tenantId ||
        row.tourId !== input.tourId ||
        row.status === "cancelled" ||
        row.status === "rejected"
      ) {
        continue;
      }
      switch (input.match.kind) {
        case "user":
          if (row.submittedByUserId === normalized) {
            const target = row.registrationIntake?.registrantTarget;
            if (target === "other") {
              break;
            }
            return cloneBooking(row);
          }
          break;
        case "label":
          if (row.guestLabel.trim().toLocaleLowerCase() === normalized) {
            return cloneBooking(row);
          }
          break;
        case "email":
          if ((row.guestEmail?.trim().toLowerCase() ?? "") === normalized) {
            return cloneBooking(row);
          }
          break;
        case "phone":
          if ((row.guestPhone?.trim().toLowerCase() ?? "") === normalized) {
            return cloneBooking(row);
          }
          break;
        case "nationalId": {
          const intake = row.registrationIntake;
          const nationalId =
            intake !== undefined && typeof intake.nationalId === "string"
              ? intake.nationalId.trim()
              : "";
          if (nationalId.length > 0 && nationalId === normalized) {
            return cloneBooking(row);
          }
          break;
        }
        default: {
          const _exhaustive: never = input.match.kind;
          return _exhaustive;
        }
      }
    }
    return null;
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
    const rows = [...bookingsStore.values()].filter((row) => row.tenantId === input.tenantId);
    const dayStart = new Date(
      Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate())
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const departuresEnd = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let pending = 0;
    let approvedToday = 0;
    let departures7d = 0;
    let waitlist = 0;
    const chipMap = new Map<
      string,
      {
        tourId: string;
        tourTitle: string;
        pendingCount: number;
        waitlistedCount: number;
        totalCount: number;
        hasUpcomingDeparture: boolean;
      }
    >();

    for (const row of rows) {
      if (row.status === "pending") {
        pending += 1;
      }
      if (row.status === "waitlisted") {
        waitlist += 1;
      }
      if (
        row.status === "approved" &&
        row.approvedAt !== null &&
        new Date(row.approvedAt) >= dayStart &&
        new Date(row.approvedAt) < dayEnd
      ) {
        approvedToday += 1;
      }
      const departure = new Date(row.departureAt);
      if (departure >= input.now && departure < departuresEnd) {
        departures7d += 1;
      }
      const chip = chipMap.get(row.tourId) ?? {
        tourId: row.tourId,
        tourTitle: row.tourTitle,
        pendingCount: 0,
        waitlistedCount: 0,
        totalCount: 0,
        hasUpcomingDeparture: false,
      };
      chip.totalCount += 1;
      if (row.status === "pending") {
        chip.pendingCount += 1;
      }
      if (row.status === "waitlisted") {
        chip.waitlistedCount += 1;
      }
      if (departure >= input.now) {
        chip.hasUpcomingDeparture = true;
      }
      chipMap.set(row.tourId, chip);
    }

    const tourChips = finalizeBookingTourChips(
      [...chipMap.values()],
      input.tourChipScope === "all" ? "all" : "ops"
    );

    return { pending, approvedToday, departures7d, waitlist, tourChips };
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
      if (row.tenantId !== tenantId || row.status !== "approved" || !tourIdSet.has(row.tourId)) {
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

  async mergeRegistrationIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly patch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null> {
    const row = bookingsStore.get(input.bookingId);
    if (row === undefined || row.tenantId !== input.tenantId) {
      return null;
    }
    const merged: BookingRecord = {
      ...row,
      registrationIntake: {
        ...(row.registrationIntake ?? {}),
        ...input.patch,
      },
    };
    bookingsStore.set(input.bookingId, merged);
    return cloneBooking(merged);
  }

  async updateGuestProjectionAndIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string | null;
    readonly guestPhone?: string | null;
    readonly intakePatch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null> {
    const row = bookingsStore.get(input.bookingId);
    if (row === undefined || row.tenantId !== input.tenantId) {
      return null;
    }
    const merged: BookingRecord = {
      ...row,
      guestLabel: input.guestLabel,
      ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
      ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
      registrationIntake: {
        ...(row.registrationIntake ?? {}),
        ...input.intakePatch,
      },
    };
    bookingsStore.set(input.bookingId, merged);
    return cloneBooking(merged);
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
    const row = bookingsStore.get(input.bookingId);
    if (
      row === undefined ||
      !isOwnedActiveOtherReclassifyCandidate({
        submittedByUserId: row.submittedByUserId,
        expectedSubmitterId: input.submittedByUserId,
        status: row.status,
        registrationIntake: row.registrationIntake,
      })
    ) {
      return null;
    }
    const merged: BookingRecord = {
      ...row,
      guestLabel: input.guestLabel,
      ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
      ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
      registrationIntake: {
        ...(row.registrationIntake ?? {}),
        ...input.intakePatch,
      },
      registrantTarget: readRegistrantTargetFromIntake({
        ...(row.registrationIntake ?? {}),
        ...input.intakePatch,
      }),
    };
    bookingsStore.set(input.bookingId, merged);
    return { id: merged.id, status: merged.status };
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
    let occupiedApprovedPartySize = 0;
    for (const row of bookingsStore.values()) {
      if (
        row.tenantId === input.tenantId &&
        row.tourId === input.body.tourId &&
        row.status === "approved"
      ) {
        occupiedApprovedPartySize += row.partySize;
      }
    }
    if (input.assertCapacityInTx !== undefined) {
      await Promise.resolve(
        input.assertCapacityInTx({
          tourId: input.body.tourId,
          partySize: input.body.partySize,
          occupiedApprovedPartySize,
        })
      );
    }
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
    assertCapacityInTx?: (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
    }) => void;
  }): Promise<BookingRecord> {
    return withMemoryApproveTx(async () => {
      const before = snapshotState();
      try {
        const current = bookingsStore.get(input.bookingId);
        if (current === undefined || current.tenantId !== input.tenantId) {
          throw new BookingNotFoundError();
        }
        if (!canTransitionBookingStatus(current.status, "approved")) {
          throw new BookingStatusConflictError(current.status);
        }

        let occupiedApprovedPartySize = 0;
        for (const row of bookingsStore.values()) {
          if (
            row.tenantId === input.tenantId &&
            row.tourId === current.tourId &&
            row.status === "approved"
          ) {
            occupiedApprovedPartySize += row.partySize;
          }
        }
        if (input.assertCapacityInTx !== undefined) {
          await Promise.resolve(
            input.assertCapacityInTx({
              booking: cloneBooking(current),
              occupiedApprovedPartySize,
            })
          );
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
            guestUserId: updated.submittedByUserId,
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

    return withMemoryApproveTx(async () => {
      const before = snapshotState();
      try {
        const approved: BookingRecord[] = [];
        for (const bookingId of input.ids) {
          const current = bookingsStore.get(bookingId);
          if (current === undefined || current.tenantId !== input.tenantId) {
            continue;
          }
          if (!canTransitionBookingStatus(current.status, "approved")) {
            continue;
          }

          let occupiedApprovedPartySize = 0;
          for (const row of bookingsStore.values()) {
            if (
              row.tenantId === input.tenantId &&
              row.tourId === current.tourId &&
              row.status === "approved"
            ) {
              occupiedApprovedPartySize += row.partySize;
            }
          }
          // Count earlier approvals in this same bulk TX.
          for (const row of approved) {
            if (row.tourId === current.tourId) {
              occupiedApprovedPartySize += row.partySize;
            }
          }

          if (input.assertCapacityInTx !== undefined) {
            await Promise.resolve(
              input.assertCapacityInTx({
                booking: cloneBooking(current),
                occupiedApprovedPartySize,
              })
            );
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
              guestUserId: updated.submittedByUserId,
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
    });
  }

  /**
   * pending|waitlisted → rejected. Persist status + optional rejectReason — no outbox (decision B).
   */
  async rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord> {
    const current = bookingsStore.get(input.bookingId);
    if (current === undefined || current.tenantId !== input.tenantId) {
      throw new BookingNotFoundError();
    }
    if (!canTransitionBookingStatus(current.status, "rejected")) {
      throw new BookingStatusConflictError(current.status);
    }
    const rejectReason =
      input.reason !== undefined && input.reason.trim().length > 0
        ? input.reason.trim()
        : undefined;
    const updated: BookingRecord = {
      ...current,
      status: "rejected",
      approvedAt: null,
      ...(rejectReason !== undefined ? { rejectReason } : {}),
    };
    bookingsStore.set(updated.id, updated);
    return cloneBooking(updated);
  }

  async waitlistBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
  }): Promise<BookingRecord> {
    const current = bookingsStore.get(input.bookingId);
    if (current === undefined || current.tenantId !== input.tenantId) {
      throw new BookingNotFoundError();
    }
    if (!canTransitionBookingStatus(current.status, "waitlisted")) {
      throw new BookingStatusConflictError(current.status);
    }
    const waitlistedAt = new Date().toISOString();
    const updated: BookingRecord = {
      ...current,
      status: "waitlisted",
      approvedAt: null,
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
        waitlistedAt,
        guestUserId: updated.submittedByUserId,
      },
      domainEventId: `registration.waitlisted:${updated.id}:${waitlistedAt}`,
      createdAt: waitlistedAt,
    });
    return cloneBooking(updated);
  }

  async cancelBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    cancelSource?: string;
  }): Promise<BookingRecord> {
    const current = bookingsStore.get(input.bookingId);
    if (current === undefined || current.tenantId !== input.tenantId) {
      throw new BookingNotFoundError();
    }
    if (!canTransitionBookingStatus(current.status, "cancelled")) {
      throw new BookingStatusConflictError(current.status);
    }
    const cancelledAt = new Date().toISOString();
    const updated: BookingRecord = {
      ...current,
      status: "cancelled",
      approvedAt: null,
      paymentDueAt: null,
      ...(input.cancelSource !== undefined ? { cancelSource: input.cancelSource } : {}),
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
        cancelledAt,
        previousStatus: current.status,
        guestUserId: updated.submittedByUserId,
        ...(input.cancelSource !== undefined ? { source: input.cancelSource } : {}),
      },
      domainEventId: `registration.cancelled:${updated.id}:${cancelledAt}`,
      createdAt: cancelledAt,
    });
    return cloneBooking(updated);
  }
}
