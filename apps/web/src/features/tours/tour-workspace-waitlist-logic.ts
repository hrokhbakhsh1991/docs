import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import { workspaceBasePath } from "@/features/tours/tour-workspace-logic";

export const TOUR_WORKSPACE_WAITLIST_TEST_IDS = {
  table: "operator-tour-workspace-waitlist-table",
  empty: "operator-tour-workspace-waitlist-empty",
  approve: "operator-tour-workspace-waitlist-approve",
  reject: "operator-tour-workspace-waitlist-reject",
  capacity: "operator-tour-workspace-waitlist-capacity",
} as const;

export function buildTourWaitlistBookingsQuery(tourId: string): string {
  const params = new URLSearchParams();
  params.set("status", "waitlisted");
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return params.toString();
}

export function buildTourWaitlistCommandCenterHref(tourId: string): string {
  const query = buildTourWaitlistBookingsQuery(tourId);
  return `/bookings?${query}`;
}

export function buildTourWaitlistBookingDetailsHref(tourId: string, bookingId: string): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  params.set("status", "waitlisted");
  params.set("bookingId", bookingId.trim());
  return `/bookings?${params.toString()}`;
}

export function sortWaitlistRows(items: readonly BookingListItem[]): BookingListItem[] {
  return [...items].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );
}

export function isTourCapacityFull(input: {
  readonly acceptedCount: number;
  readonly totalCapacity: number | null | undefined;
}): boolean {
  const capacity = input.totalCapacity;
  if (capacity === null || capacity === undefined || !Number.isFinite(capacity)) {
    return false;
  }
  return input.acceptedCount >= Math.trunc(capacity);
}

export function buildTourWaitlistRegistrationsHref(tourId: string): string {
  return workspaceBasePath(tourId);
}
