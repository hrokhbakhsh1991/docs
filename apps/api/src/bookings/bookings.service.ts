import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getBookingsRepository } from "./create-bookings-repository";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
} from "./in-memory-bookings.repository";
import type {
  ApproveBookingResponse,
  BookingListItem,
  BookingRecord,
  BookingTourChip,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
} from "./bookings.types";

const APPROVE_OUTBOX_EVENT = "registration.approved";
const BULK_APPROVE_MAX_BATCH = 25;

export class BookingsOpsForbiddenError extends Error {
  readonly code = "BOOKINGS_OPS_FORBIDDEN" as const;

  constructor() {
    super("BOOKINGS_OPS_FORBIDDEN");
    this.name = "BookingsOpsForbiddenError";
  }
}

function isAdminOrOwner(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner";
}

function assertAdminOrOwner(auth: TenantAuthContext): void {
  if (!isAdminOrOwner(auth)) {
    throw new BookingsOpsForbiddenError();
  }
}

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
  };
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

export async function listBookings(
  auth: TenantAuthContext,
  query: BookingsListQuery
): Promise<BookingsListResponse> {
  if (query.view === "ops") {
    assertAdminOrOwner(auth);
  }

  const repo = getBookingsRepository();
  let rows = await repo.listByTenant(auth.tenantId);

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
    startIndex + query.limit < total && page.length > 0 ? (page[page.length - 1]?.id ?? null) : null;

  return {
    items: page.map(toListItem),
    total,
    nextCursor,
  };
}

export async function getBookingsSummary(auth: TenantAuthContext): Promise<BookingsSummaryResponse> {
  assertAdminOrOwner(auth);
  const now = new Date();
  const repo = getBookingsRepository();
  const rows = await repo.listByTenant(auth.tenantId);

  return {
    pending: rows.filter((row) => row.status === "pending").length,
    approvedToday: rows.filter((row) => isApprovedToday(row, now)).length,
    departures7d: rows.filter((row) => isDepartureWithin7Days(row, now)).length,
    waitlist: rows.filter((row) => row.status === "waitlisted").length,
    tourChips: buildTourChips(rows),
  };
}

export async function createBooking(
  auth: TenantAuthContext,
  body: CreateBookingRequest
): Promise<CreateBookingResponse> {
  assertAdminOrOwner(auth);
  const repo = getBookingsRepository();
  const created = await repo.createBooking({
    tenantId: auth.tenantId,
    submittedByUserId: auth.userId,
    body,
  });
  return { id: created.id, status: created.status };
}

export async function sumApprovedPartySizeByTourIds(
  tenantId: string,
  tourIds: readonly string[]
): Promise<Readonly<Record<string, number>>> {
  if (tourIds.length === 0) {
    return {};
  }
  const repo = getBookingsRepository();
  return repo.sumApprovedPartySizeByTourIds(tenantId, tourIds);
}

export async function findGuestBookingDuplicate(
  tenantId: string,
  tourId: string,
  email: string
): Promise<BookingRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return null;
  }
  const repo = getBookingsRepository();
  const rows = await repo.listByTenant(tenantId);
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

export async function createPublicGuestBooking(
  auth: TenantAuthContext,
  body: CreateBookingRequest
): Promise<CreateBookingResponse> {
  const repo = getBookingsRepository();
  const created = await repo.createBooking({
    tenantId: auth.tenantId,
    submittedByUserId: auth.userId,
    body,
  });
  return { id: created.id, status: created.status };
}

export async function approveBooking(
  auth: TenantAuthContext,
  bookingId: string
): Promise<ApproveBookingResponse> {
  assertAdminOrOwner(auth);
  const repo = getBookingsRepository();
  const updated = await repo.approveWithOutbox({
    bookingId,
    tenantId: auth.tenantId,
    outboxEvent: APPROVE_OUTBOX_EVENT,
  });
  return {
    id: updated.id,
    status: updated.status,
    approvedAt: updated.approvedAt ?? new Date().toISOString(),
  };
}

export async function rejectBooking(
  auth: TenantAuthContext,
  bookingId: string,
  body: RejectBookingRequest
): Promise<RejectBookingResponse> {
  assertAdminOrOwner(auth);
  const repo = getBookingsRepository();
  const updated = await repo.rejectBooking({
    bookingId,
    tenantId: auth.tenantId,
    ...(body.reason !== undefined ? { reason: body.reason } : {}),
  });
  return { id: updated.id, status: updated.status };
}

export async function bulkApproveBookings(
  auth: TenantAuthContext,
  body: BulkApproveBookingsRequest
): Promise<BulkApproveBookingsResponse> {
  assertAdminOrOwner(auth);
  const uniqueIds = [...new Set(body.ids.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    return { approvedIds: [], skippedIds: [] };
  }

  const repo = getBookingsRepository();
  const approved = await repo.bulkApproveWithOutbox({
    ids: uniqueIds,
    tenantId: auth.tenantId,
    outboxEvent: APPROVE_OUTBOX_EVENT,
    maxBatch: BULK_APPROVE_MAX_BATCH,
  });
  const approvedIds = approved.map((row) => row.id);
  const approvedSet = new Set(approvedIds);
  const skippedIds = uniqueIds.filter((id) => !approvedSet.has(id));
  return { approvedIds, skippedIds };
}

export {
  BookingNotFoundError,
  BookingStatusConflictError,
  BulkApproveBatchLimitError,
};
