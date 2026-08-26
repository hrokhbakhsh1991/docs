/**
 * DP-2 — tour workspace operational roster logic (transport tab).
 */
import { extractTransportModesFromTourPayload } from "@/features/tours/tour-canonical-transport-modes";

export { extractTransportModesFromTourPayload };

/** HTTP query filter values for `/tours/:id/operational-roster` (DEN-PROD-03). */
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
  readonly memberUserId?: string;
  readonly memberAvatarUrl?: string | null;
  readonly partySize: number;
  readonly registrationStatus: string;
  readonly financialDisplayState: string;
  readonly remainingMinor: string | null;
  readonly paidMinor: string | null;
  readonly currency: string | null;
  readonly paymentDueAt: string | null;
  readonly holdStatus: string | null;
  readonly transportKind: string | null;
  readonly personalCarOccupants: number | null;
  readonly isDriverOffer: boolean;
  readonly passengerAssignmentStatus: string;
  readonly refundDisplayState: string;
  readonly isFinalParticipant: boolean;
  readonly isOperationalParticipant: boolean;
  readonly departureAt: string;
  readonly submittedAt: string;
};

export type TourOperationalRosterResponse = {
  readonly tourId: string;
  readonly filter: OperationalRosterFilter;
  readonly items: readonly TourOperationalRosterRow[];
  readonly total: number;
  readonly nextCursor: string | null;
};

export const TOUR_WORKSPACE_TRANSPORT_TEST_IDS = {
  modes: "operator-tour-workspace-transport-modes",
  modeCounts: "operator-tour-workspace-transport-mode-counts",
  table: "operator-tour-workspace-transport-table",
  empty: "operator-tour-workspace-transport-empty",
  filters: "operator-tour-workspace-operational-roster-filters",
  finalBadge: "operator-tour-workspace-operational-roster-final",
  amountDue: "operator-tour-workspace-operational-roster-amount-due",
  paymentDeadline: "operator-tour-workspace-operational-roster-deadline",
  driverBadge: "operator-tour-workspace-operational-roster-driver",
  settlementPanel: "operator-tour-workspace-driver-settlement",
  settlementTotal: "operator-tour-workspace-driver-settlement-total",
  settlementStatus: "operator-tour-workspace-driver-settlement-status",
  freezeButton: "operator-tour-workspace-roster-freeze",
  approvePayableButton: "operator-tour-workspace-settlement-approve-payable",
} as const;

export const OPERATIONAL_ROSTER_FILTERS: readonly OperationalRosterFilter[] = [
  "operational",
  "final",
  "unpaid",
  "paid",
  "expiring",
  "waitlist",
];

export function buildTourOperationalRosterQuery(
  tourId: string,
  filter: OperationalRosterFilter = "operational",
  transportKind?: string
): string {
  const params = new URLSearchParams();
  params.set("view", "ops");
  params.set("filter", filter);
  if (transportKind !== undefined && transportKind.trim().length > 0) {
    params.set("transportKind", transportKind.trim());
  }
  void tourId;
  return params.toString();
}

export function buildTourOperationalRosterHref(
  tourId: string,
  filter: OperationalRosterFilter = "operational"
): string {
  return `/api/tours/${encodeURIComponent(tourId)}/operational-roster?${buildTourOperationalRosterQuery(tourId, filter)}`;
}

export type DriverSettlementRow = {
  readonly settlementId: string;
  readonly driverRegistrationId: string;
  readonly offeredSeats: number;
  readonly assignedPassengers: number;
  readonly billableQuantity: number;
  readonly unitAmountMinor: string;
  readonly totalMinor: string;
  readonly status: string;
  readonly currency: string;
};

/** @deprecated Use buildTourOperationalRosterQuery — bookings list no longer authoritative for DP-2. */
export function buildTourTransportBookingsQuery(tourId: string): string {
  return buildTourOperationalRosterQuery(tourId, "operational");
}

export function buildTourTransportCommandCenterHref(tourId: string): string {
  const params = new URLSearchParams();
  params.set("status", "approved");
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return `/bookings?${params.toString()}`;
}

export function formatTransportModeLabel(mode: string): string {
  return mode
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sortTransportRosterRows(
  items: readonly TourOperationalRosterRow[]
): TourOperationalRosterRow[] {
  return [...items].sort((a, b) => {
    const guestCompare = a.guestLabel.localeCompare(b.guestLabel, undefined, {
      sensitivity: "base",
    });
    if (guestCompare !== 0) {
      return guestCompare;
    }
    return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
  });
}

export function countTransportRosterByIntakeKind(
  items: readonly TourOperationalRosterRow[]
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

export function formatOperationalRosterAmountDue(
  row: Pick<TourOperationalRosterRow, "remainingMinor" | "currency" | "financialDisplayState">
): string | null {
  if (row.financialDisplayState === "NOT_APPLICABLE" || row.financialDisplayState === "WAIVED") {
    return null;
  }
  if (row.remainingMinor === null) {
    return null;
  }
  const digits = row.remainingMinor.replace(/\D/g, "");
  if (digits.length === 0 || digits === "0") {
    return null;
  }
  return row.currency !== null ? `${digits} ${row.currency}` : digits;
}
