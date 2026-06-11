import type { BookingRecord, BookingStatus } from "../bookings/bookings.types";
import type { UserBookingSummaryResponse, UserBookingTripRow } from "./users.types";

const CANCELLED_STATUSES = new Set<BookingStatus>(["cancelled", "rejected"]);

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

  return {
    totalTrips,
    completedTrips,
    cancelledTrips,
    trips: sorted.slice(0, 10).map(toTripRow),
  };
}
