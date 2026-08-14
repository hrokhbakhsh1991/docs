import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

export const TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS = {
  registerLink: "operator-tour-workspace-registrations-register",
} as const;

export function buildTourRegistrationsWorkspaceQuery(tourId: string): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return params.toString();
}

/** Command Center deep link — same tour scope as workspace embed (all statuses unless filtered in CC). */
export function buildTourRegistrationsBookingsQuery(tourId: string): string {
  const params = new URLSearchParams();
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
