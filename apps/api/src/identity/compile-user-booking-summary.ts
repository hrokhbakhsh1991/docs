import type { BookingRecord, BookingStatus } from "../bookings/bookings.types";
import { MAX_MEMBER_BOOKINGS_RECENT_TRIPS } from "../bookings/bookings-member-summary-projection";
import type { UserBookingSummaryResponse, UserBookingTripRow } from "./users.types";

const CANCELLED_STATUSES = new Set<BookingStatus>(["cancelled", "rejected"]);

export type MemberBookingSummaryCounts = {
  readonly totalTrips: number;
  readonly completedTrips: number;
  readonly cancelledTrips: number;
};

function isCompletedTrip(row: BookingRecord, now: Date): boolean {
  if (CANCELLED_STATUSES.has(row.status)) {
    return false;
  }
  const departure = new Date(row.departureAt);
  return !Number.isNaN(departure.getTime()) && departure.getTime() < now.getTime();
}

function toTripRow(row: BookingRecord): UserBookingTripRow {
  return {
    bookingId: row.id,
    tourTitle: row.tourTitle,
    status: row.status,
    paymentStatus: row.paymentStatus,
    departureAt: row.departureAt,
    partySize: row.partySize,
  };
}

export function compileUserBookingSummaryFromCounts(
  counts: MemberBookingSummaryCounts,
  recentRows: readonly BookingRecord[]
): UserBookingSummaryResponse {
  const sorted = [...recentRows].sort(
    (left, right) => new Date(right.departureAt).getTime() - new Date(left.departureAt).getTime()
  );

  return {
    ...counts,
    trips: sorted.slice(0, MAX_MEMBER_BOOKINGS_RECENT_TRIPS).map(toTripRow),
  };
}

export function compileUserBookingSummary(
  rows: readonly BookingRecord[],
  now: Date = new Date()
): UserBookingSummaryResponse {
  const sorted = [...rows].sort(
    (left, right) => new Date(right.departureAt).getTime() - new Date(left.departureAt).getTime()
  );
  const totalTrips = sorted.length;
  const cancelledTrips = sorted.filter((row) => CANCELLED_STATUSES.has(row.status)).length;
  const completedTrips = sorted.filter((row) => isCompletedTrip(row, now)).length;

  return compileUserBookingSummaryFromCounts(
    { totalTrips, completedTrips, cancelledTrips },
    sorted
  );
}
