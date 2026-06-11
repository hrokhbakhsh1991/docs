import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

export const TOUR_WORKSPACE_WAITLIST_TEST_IDS = {
  table: "operator-tour-workspace-waitlist-table",
  empty: "operator-tour-workspace-waitlist-empty",
  approve: "operator-tour-workspace-waitlist-approve",
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

export function sortWaitlistRows(items: readonly BookingListItem[]): BookingListItem[] {
  return [...items].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );
}
