import type { BookingActorContext } from "./ports/booking-actor-context";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import type {
  ApproveBookingResponse,
  BookingListItem,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";
import type { BookingRecord, BookingTourChip } from "./bookings.types";

const BULK_APPROVE_MAX_BATCH = 25;

export type BookingsServiceDeps = {
  readonly repository: BookingRepositoryPort;
  readonly authorization: BookingAuthorizationPort;
  readonly clock: BookingClockPort;
  readonly eventReaction: WorkspaceBookingEventReactionPort;
};

function toListItem(record: BookingRecord): BookingListItem {
  return {
    id: record.id,
    tourId: record.tourId,
    tourTitle: record.tourTitle,
    guestLabel: record.guestLabel,
    partySize: record.partySize,
    status: record.status,
    paymentStatus: record.paymentStatus,
    departureAt: record.departureAt,
    submittedAt: record.submittedAt,
    ...(record.registrationIntake !== undefined
      ? { registrationIntake: record.registrationIntake }
      : {}),
  };
}

function readRegistrationIntakeNationalId(
  intake: Readonly<Record<string, unknown>> | undefined
): string | null {
  if (intake === undefined) {
    return null;
  }
  const nationalId = intake.nationalId;
  if (typeof nationalId !== "string") {
    return null;
  }
  const trimmed = nationalId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchesSearch(record: BookingRecord, q: string | undefined): boolean {
  if (q === undefined || q.trim().length === 0) {
    return true;
  }
  const needle = q.trim().toLocaleLowerCase();
  const haystacks = [record.guestLabel, record.guestEmail ?? "", record.guestPhone ?? ""];
  return haystacks.some((value) => value.toLocaleLowerCase().includes(needle));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isApprovedToday(record: BookingRecord, now: Date): boolean {
  if (record.status !== "approved" || record.approvedAt === null) {
    return false;
  }
  const approvedAt = new Date(record.approvedAt);
  return approvedAt >= startOfUtcDay(now);
}

function isDepartureWithin7Days(record: BookingRecord, now: Date): boolean {
  const departure = new Date(record.departureAt);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 7);
  return departure >= now && departure <= end;
}

function buildTourChips(rows: readonly BookingRecord[]): readonly BookingTourChip[] {
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
  return [...byTour.values()].sort((a, b) => b.pendingCount - a.pendingCount);
}

/**
 * Booking application service — constructor DI only (Phase B0.5).
 * Dependencies are injected; persistence is not resolved inside this class.
 */
export class BookingsService {
  private readonly repository: BookingRepositoryPort;
  private readonly authorization: BookingAuthorizationPort;
  private readonly clock: BookingClockPort;
  private readonly eventReaction: WorkspaceBookingEventReactionPort;

  constructor(deps: BookingsServiceDeps) {
    if (deps.repository == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:repository");
    }
    if (deps.authorization == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:authorization");
    }
    if (deps.clock == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:clock");
    }
    if (deps.eventReaction == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:eventReaction");
    }
    this.repository = deps.repository;
    this.authorization = deps.authorization;
    this.clock = deps.clock;
    this.eventReaction = deps.eventReaction;
  }

  async listBookings(
    auth: BookingActorContext,
    query: BookingsListQuery
  ): Promise<BookingsListResponse> {
    if (query.view === "ops") {
      this.authorization.assertOpsAccess(auth);
    }

    let rows = await this.repository.listByTenant(auth.tenantId);

    if (query.view === "mine") {
      rows = rows.filter((row) => row.submittedByUserId === auth.userId);
    }

    if (query.status !== undefined) {
      rows = rows.filter((row) => row.status === query.status);
    }

    if (query.tourId !== undefined && query.tourId.length > 0) {
      rows = rows.filter((row) => row.tourId === query.tourId);
    }

    if (query.paymentStatus !== undefined) {
      rows = rows.filter((row) => row.paymentStatus === query.paymentStatus);
    }

    rows = rows.filter((row) => matchesSearch(row, query.q));
    rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    const total = rows.length;
    let startIndex = 0;
    if (query.cursor !== undefined && query.cursor.length > 0) {
      const cursorIndex = rows.findIndex((row) => row.id === query.cursor);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const page = rows.slice(startIndex, startIndex + query.limit);
    const nextCursor =
      startIndex + query.limit < total && page.length > 0
        ? (page[page.length - 1]?.id ?? null)
        : null;

    return {
      items: page.map(toListItem),
      total,
      nextCursor,
    };
  }

  async getBookingsSummary(auth: BookingActorContext): Promise<BookingsSummaryResponse> {
    this.authorization.assertOpsAccess(auth);
    const now = this.clock.now();
    const rows = await this.repository.listByTenant(auth.tenantId);

    return {
      pending: rows.filter((row) => row.status === "pending").length,
      approvedToday: rows.filter((row) => isApprovedToday(row, now)).length,
      departures7d: rows.filter((row) => isDepartureWithin7Days(row, now)).length,
      waitlist: rows.filter((row) => row.status === "waitlisted").length,
      tourChips: buildTourChips(rows),
    };
  }

  async createBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    this.authorization.assertOpsAccess(auth);
    const created = await this.repository.createBooking({
      tenantId: auth.tenantId,
      submittedByUserId: auth.userId,
      body,
    });
    return { id: created.id, status: created.status };
  }

  async sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>> {
    if (tourIds.length === 0) {
      return {};
    }
    return this.repository.sumApprovedPartySizeByTourIds(tenantId, tourIds);
  }

  async findGuestBookingDuplicateByUser(
    tenantId: string,
    tourId: string,
    guestUserId: string
  ): Promise<BookingRecord | null> {
    const normalizedUserId = guestUserId.trim();
    if (normalizedUserId.length === 0) {
      return null;
    }
    const rows = await this.repository.listByTenant(tenantId);
    return (
      rows.find(
        (row) =>
          row.tourId === tourId &&
          row.status !== "cancelled" &&
          row.status !== "rejected" &&
          row.submittedByUserId === normalizedUserId
      ) ?? null
    );
  }

  async findGuestBookingDuplicateByGuestLabel(
    tenantId: string,
    tourId: string,
    guestLabel: string
  ): Promise<BookingRecord | null> {
    const normalizedLabel = guestLabel.trim().toLocaleLowerCase();
    if (normalizedLabel.length === 0) {
      return null;
    }
    const rows = await this.repository.listByTenant(tenantId);
    return (
      rows.find(
        (row) =>
          row.tourId === tourId &&
          row.status !== "cancelled" &&
          row.status !== "rejected" &&
          row.guestLabel.trim().toLocaleLowerCase() === normalizedLabel
      ) ?? null
    );
  }

  async findGuestBookingDuplicateByTourNationalId(
    tenantId: string,
    tourId: string,
    nationalId: string
  ): Promise<BookingRecord | null> {
    const normalizedNationalId = nationalId.trim();
    if (normalizedNationalId.length === 0) {
      return null;
    }
    const rows = await this.repository.listByTenant(tenantId);
    return (
      rows.find((row) => {
        if (row.tourId !== tourId || row.status === "cancelled" || row.status === "rejected") {
          return false;
        }
        return readRegistrationIntakeNationalId(row.registrationIntake) === normalizedNationalId;
      }) ?? null
    );
  }

  async findGuestBookingDuplicate(
    tenantId: string,
    tourId: string,
    email: string
  ): Promise<BookingRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length === 0) {
      return null;
    }
    const rows = await this.repository.listByTenant(tenantId);
    return (
      rows.find(
        (row) =>
          row.tourId === tourId &&
          row.status !== "cancelled" &&
          row.status !== "rejected" &&
          (row.guestEmail?.trim().toLowerCase() ?? "") === normalizedEmail
      ) ?? null
    );
  }

  async createPublicGuestBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    const created = await this.repository.createBooking({
      tenantId: auth.tenantId,
      submittedByUserId: auth.userId,
      body,
    });
    return { id: created.id, status: created.status };
  }

  async approveBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<ApproveBookingResponse> {
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.approveWithOutbox({
      bookingId,
      tenantId: auth.tenantId,
      outboxEvent: this.eventReaction.approveOutboxEventType,
    });
    return {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt ?? this.clock.now().toISOString(),
    };
  }

  async rejectBooking(
    auth: BookingActorContext,
    bookingId: string,
    body: RejectBookingRequest
  ): Promise<RejectBookingResponse> {
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.rejectBooking({
      bookingId,
      tenantId: auth.tenantId,
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
    return { id: updated.id, status: updated.status };
  }

  async bulkApproveBookings(
    auth: BookingActorContext,
    body: BulkApproveBookingsRequest
  ): Promise<BulkApproveBookingsResponse> {
    this.authorization.assertOpsAccess(auth);
    const uniqueIds = [...new Set(body.ids.filter((id) => id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return { approvedIds: [], skippedIds: [] };
    }

    const approved = await this.repository.bulkApproveWithOutbox({
      ids: uniqueIds,
      tenantId: auth.tenantId,
      outboxEvent: this.eventReaction.approveOutboxEventType,
      maxBatch: BULK_APPROVE_MAX_BATCH,
    });
    const approvedIds = approved.map((row) => row.id);
    const approvedSet = new Set(approvedIds);
    const skippedIds = uniqueIds.filter((id) => !approvedSet.has(id));
    return { approvedIds, skippedIds };
  }
}

export function createBookingsService(deps: BookingsServiceDeps): BookingsService {
  return new BookingsService(deps);
}
