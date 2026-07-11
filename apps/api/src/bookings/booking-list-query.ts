import type { BookingListPageInput, BookingRecord } from "./bookings.types";

export function normalizeBookingSearchQuery(q: string | undefined): string | undefined {
  const trimmed = q?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

export function matchesBookingListFilters(
  record: BookingRecord,
  filters: Pick<
    BookingListPageInput,
    "status" | "tourId" | "paymentStatus" | "submittedByUserId" | "q"
  >,
): boolean {
  if (filters.submittedByUserId !== undefined && record.submittedByUserId !== filters.submittedByUserId) {
    return false;
  }
  if (filters.status !== undefined && record.status !== filters.status) {
    return false;
  }
  if (filters.tourId !== undefined && filters.tourId.length > 0 && record.tourId !== filters.tourId) {
    return false;
  }
  if (filters.paymentStatus !== undefined && record.paymentStatus !== filters.paymentStatus) {
    return false;
  }

  const needle = normalizeBookingSearchQuery(filters.q)?.toLocaleLowerCase();
  if (needle === undefined) {
    return true;
  }

  const haystacks = [record.guestLabel, record.guestEmail ?? "", record.guestPhone ?? ""];
  return haystacks.some((value) => value.toLocaleLowerCase().includes(needle));
}

export function compareBookingsBySubmittedAtDesc(left: BookingRecord, right: BookingRecord): number {
  const submittedDelta = right.submittedAt.localeCompare(left.submittedAt);
  if (submittedDelta !== 0) {
    return submittedDelta;
  }
  return right.id.localeCompare(left.id);
}

/** Rows strictly after `cursor` in `(submittedAt desc, id desc)` order — keyset next page. */
export function isBookingAfterKeysetCursor(
  record: BookingRecord,
  cursor: { readonly submittedAt: string; readonly id: string }
): boolean {
  if (record.submittedAt < cursor.submittedAt) {
    return true;
  }
  if (record.submittedAt === cursor.submittedAt && record.id < cursor.id) {
    return true;
  }
  return false;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
