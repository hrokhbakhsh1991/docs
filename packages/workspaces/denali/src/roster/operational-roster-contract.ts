/**
 * DP-2 — HTTP contract for tour operational roster (DEN-PROD-03).
 */
import type { BookingTransportKind } from "@app-tour/booking-http-contracts";

import type {
  OperationalRosterFinancialDisplayState,
  OperationalRosterLifecycleStatus,
  OperationalRosterPassengerAssignmentStatus,
  OperationalRosterRefundDisplayState,
} from "./operational-roster-semantics";

export type OperationalRosterFilter =
  | "operational"
  | "final"
  | "unpaid"
  | "paid"
  | "expiring"
  | "waitlist";

export type TourOperationalRosterRow = {
  readonly registrationId: string;
  readonly tourId: string;
  readonly guestLabel: string;
  /** Ops list projection — submitter user id for avatar parity. */
  readonly memberUserId?: string;
  /** Ops list projection — presigned avatar URL when membership has storage key. */
  readonly memberAvatarUrl?: string | null;
  readonly partySize: number;
  readonly registrationStatus: OperationalRosterLifecycleStatus;
  readonly financialDisplayState: OperationalRosterFinancialDisplayState;
  readonly remainingMinor: string | null;
  readonly paidMinor: string | null;
  readonly currency: string | null;
  readonly paymentDueAt: string | null;
  readonly holdStatus: string | null;
  readonly transportKind: BookingTransportKind | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly isDriverOffer: boolean;
  readonly passengerAssignmentStatus: OperationalRosterPassengerAssignmentStatus;
  readonly refundDisplayState: OperationalRosterRefundDisplayState;
  readonly isFinalParticipant: boolean;
  readonly isOperationalParticipant: boolean;
  readonly isFinanciallySettled: boolean;
  readonly occupiesCapacity: boolean;
  readonly departureAt: string;
  readonly submittedAt: string;
};

export type OperationalRosterListQuery = {
  readonly view: "ops";
  readonly filter: OperationalRosterFilter;
  readonly transportKind?: BookingTransportKind;
  readonly limit: number;
  readonly cursor?: string;
};

export type OperationalRosterListResponse = {
  readonly tourId: string;
  readonly filter: OperationalRosterFilter;
  readonly items: readonly TourOperationalRosterRow[];
  readonly total: number;
  readonly nextCursor: string | null;
};

const ROSTER_FILTERS: readonly OperationalRosterFilter[] = [
  "operational",
  "final",
  "unpaid",
  "paid",
  "expiring",
  "waitlist",
];

const TRANSPORT_KINDS: readonly BookingTransportKind[] = [
  "primary",
  "personal_car",
  "no_car_dong",
  "no_car_acquaintance",
];

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (value === null || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function parseOperationalRosterListQuery(url: URL): OperationalRosterListQuery {
  const filterRaw = (url.searchParams.get("filter") ?? "operational").trim().toLowerCase();
  const filter = ROSTER_FILTERS.includes(filterRaw as OperationalRosterFilter)
    ? (filterRaw as OperationalRosterFilter)
    : "operational";

  const transportRaw = url.searchParams.get("transportKind")?.trim() ?? "";
  const transportKind = TRANSPORT_KINDS.includes(transportRaw as BookingTransportKind)
    ? (transportRaw as BookingTransportKind)
    : undefined;

  const limit = parsePositiveInt(url.searchParams.get("limit"), 50, 100);
  const cursor = url.searchParams.get("cursor")?.trim();
  const viewRaw = (url.searchParams.get("view") ?? "ops").trim().toLowerCase();

  return {
    view: viewRaw === "ops" ? "ops" : "ops",
    filter,
    ...(transportKind !== undefined ? { transportKind } : {}),
    limit,
    ...(cursor !== undefined && cursor.length > 0 ? { cursor } : {}),
  };
}
