import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

export const TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS = {
  table: "operator-tour-workspace-registrations-table",
  empty: "operator-tour-workspace-registrations-empty",
  registerLink: "operator-tour-workspace-registrations-register",
} as const;

export function buildTourRegistrationsBookingsQuery(tourId: string): string {
  const params = new URLSearchParams();
  params.set("status", "pending");
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return params.toString();
}

export function buildTourRegistrationsCommandCenterHref(tourId: string): string {
  const query = buildTourRegistrationsBookingsQuery(tourId);
  return `/bookings?${query}`;
}

export function sortRegistrationRows(items: readonly BookingListItem[]): BookingListItem[] {
  return [...items].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );
}
