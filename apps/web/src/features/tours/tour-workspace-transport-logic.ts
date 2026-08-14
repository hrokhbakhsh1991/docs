import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import { extractTransportModesFromTourPayload } from "@/features/tours/tour-canonical-transport-modes";

export { extractTransportModesFromTourPayload };

export const TOUR_WORKSPACE_TRANSPORT_TEST_IDS = {
  modes: "operator-tour-workspace-transport-modes",
  modeCounts: "operator-tour-workspace-transport-mode-counts",
  table: "operator-tour-workspace-transport-table",
  empty: "operator-tour-workspace-transport-empty",
} as const;

export function buildTourTransportBookingsQuery(tourId: string): string {
  const params = new URLSearchParams();
  params.set("status", "approved");
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return params.toString();
}

export function buildTourTransportCommandCenterHref(tourId: string): string {
  const query = buildTourTransportBookingsQuery(tourId);
  return `/bookings?${query}`;
}

export function formatTransportModeLabel(mode: string): string {
  return mode
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sortTransportRosterRows(items: readonly BookingListItem[]): BookingListItem[] {
  return [...items].sort((a, b) => {
    const guestCompare = a.guestLabel.localeCompare(b.guestLabel, undefined, { sensitivity: "base" });
    if (guestCompare !== 0) {
      return guestCompare;
    }
    return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
  });
}

/** H5 — roster counts by guest intake transport kind (list scalar or unknown). */
export function countTransportRosterByIntakeKind(
  items: readonly BookingListItem[]
): ReadonlyArray<{ readonly kind: string; readonly count: number }> {
  const map = new Map<string, number>();
  for (const row of items) {
    const key = row.transportKind ?? "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}
