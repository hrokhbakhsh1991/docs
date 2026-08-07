import type { BookingListPageInput, BookingRecord } from "./bookings.types";

export type BookingListSortMode = NonNullable<BookingListPageInput["sort"]>;

export function normalizeBookingSearchQuery(q: string | undefined): string | undefined {
  const trimmed = q?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * UTC calendar-day window ending at tomorrow UTC midnight.
 * N=1 matches summary `approvedToday` (UX-BKG-43b).
 */
export function resolveUtcApprovedWithinDaysWindow(
  now: Date,
  days: number
): { readonly approvedFrom: string; readonly approvedTo: string } {
  const n = Math.max(1, Math.floor(days));
  const dayStartTodayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const approvedToMs = dayStartTodayMs + 24 * 60 * 60 * 1000;
  const approvedFromMs = approvedToMs - n * 24 * 60 * 60 * 1000;
  return {
    approvedFrom: new Date(approvedFromMs).toISOString(),
    approvedTo: new Date(approvedToMs).toISOString(),
  };
}

export function matchesBookingListFilters(
  record: BookingRecord,
  filters: Pick<
    BookingListPageInput,
    | "status"
    | "statuses"
    | "tourId"
    | "paymentStatus"
    | "submittedByUserId"
    | "q"
    | "departureFrom"
    | "departureTo"
    | "approvedFrom"
    | "approvedTo"
  >,
): boolean {
  if (filters.submittedByUserId !== undefined && record.submittedByUserId !== filters.submittedByUserId) {
    return false;
  }
  if (filters.statuses !== undefined && filters.statuses.length > 0) {
    if (!filters.statuses.includes(record.status)) {
      return false;
    }
  } else if (filters.status !== undefined && record.status !== filters.status) {
    return false;
  }
  if (filters.tourId !== undefined && filters.tourId.length > 0 && record.tourId !== filters.tourId) {
    return false;
  }
  if (filters.paymentStatus !== undefined && record.paymentStatus !== filters.paymentStatus) {
    return false;
  }

  if (filters.departureFrom !== undefined || filters.departureTo !== undefined) {
    const departureMs = Date.parse(record.departureAt);
    if (Number.isNaN(departureMs)) {
      return false;
    }
    if (filters.departureFrom !== undefined) {
      const fromMs = Date.parse(filters.departureFrom);
      if (!Number.isNaN(fromMs) && departureMs < fromMs) {
        return false;
      }
    }
    if (filters.departureTo !== undefined) {
      const toMs = Date.parse(filters.departureTo);
      if (!Number.isNaN(toMs) && departureMs >= toMs) {
        return false;
      }
    }
  }

  if (filters.approvedFrom !== undefined || filters.approvedTo !== undefined) {
    if (record.approvedAt === null || record.approvedAt.trim().length === 0) {
      return false;
    }
    const approvedMs = Date.parse(record.approvedAt);
    if (Number.isNaN(approvedMs)) {
      return false;
    }
    if (filters.approvedFrom !== undefined) {
      const fromMs = Date.parse(filters.approvedFrom);
      if (!Number.isNaN(fromMs) && approvedMs < fromMs) {
        return false;
      }
    }
    if (filters.approvedTo !== undefined) {
      const toMs = Date.parse(filters.approvedTo);
      if (!Number.isNaN(toMs) && approvedMs >= toMs) {
        return false;
      }
    }
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

/** Soonest departure first — BOOKINGS-OPS-UX P3b-a. */
export function compareBookingsByDepartureAtAsc(left: BookingRecord, right: BookingRecord): number {
  const departureDelta = left.departureAt.localeCompare(right.departureAt);
  if (departureDelta !== 0) {
    return departureDelta;
  }
  return left.id.localeCompare(right.id);
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

/** Rows strictly after `cursor` in `(departureAt asc, id asc)` order — keyset next page. */
export function isBookingAfterDepartureKeysetCursor(
  record: BookingRecord,
  cursor: { readonly departureAt: string; readonly id: string }
): boolean {
  if (record.departureAt > cursor.departureAt) {
    return true;
  }
  if (record.departureAt === cursor.departureAt && record.id > cursor.id) {
    return true;
  }
  return false;
}

export function resolveBookingListSortMode(
  sort: BookingListPageInput["sort"] | undefined
): BookingListSortMode {
  return sort === "departureAt" ? "departureAt" : "submittedAt";
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
