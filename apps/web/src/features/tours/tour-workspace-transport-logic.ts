import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

export const TOUR_WORKSPACE_TRANSPORT_TEST_IDS = {
  modes: "operator-tour-workspace-transport-modes",
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

function readTransportModesValue(raw: unknown): readonly string[] {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function readNestedTransportModes(
  data: Record<string, unknown>,
  path: readonly string[]
): readonly string[] {
  let cursor: unknown = data;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null) {
      return [];
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (typeof cursor !== "object" || cursor === null) {
    return [];
  }
  return readTransportModesValue((cursor as Record<string, unknown>).transportModes);
}

export function extractTransportModesFromTourPayload(payload: Record<string, unknown>): string[] {
  const canonical = payload.canonical;
  if (typeof canonical !== "object" || canonical === null) {
    return [];
  }
  const data = (canonical as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) {
    return [];
  }
  const record = data as Record<string, unknown>;
  const modes = new Set<string>();
  for (const mode of readNestedTransportModes(record, ["details", "tripDetails"])) {
    modes.add(mode.trim());
  }
  for (const mode of readNestedTransportModes(record, ["tripDetails"])) {
    modes.add(mode.trim());
  }
  for (const mode of readTransportModesValue(record.transportModes)) {
    modes.add(mode.trim());
  }
  return [...modes].sort((a, b) => a.localeCompare(b));
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
