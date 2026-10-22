/**
 * DP-2 — tour workspace operational roster logic (transport tab).
 */
import { extractTransportModesFromTourPayload } from "@/features/tours/tour-canonical-transport-modes";
import { toAsciiDigits } from "@/i18n/format-localized-digits";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";

export { extractTransportModesFromTourPayload };

/** Normalize a driver-seat amount without accepting signs, decimals, or letters. */
export function normalizeDriverCompensationPerSeat(raw: string): string | null {
  const ascii = toAsciiDigits(raw).trim();
  const normalized = ascii.replace(/[\s,_٬،]/g, "");
  return /^\d+$/.test(normalized) && normalized !== "0" ? normalized : null;
}

/** HTTP query filter values for `/tours/:id/operational-roster` (DEN-PROD-03). */
export type OperationalRosterFilter =
  | "operational"
  | "final"
  | "awaiting_finalization"
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
  readonly amountDueNowMinor?: string | null;
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

export type OperationalRosterStage =
  | "approved_payment_required"
  | "approved_ready_to_finalize"
  | "final_open_payment"
  | "final_ready";

/** One primary, human-readable stage for the four approval/finalization cases. */
export function resolveOperationalRosterStage(
  row: Pick<TourOperationalRosterRow, "isFinalParticipant" | "financialDisplayState">
): OperationalRosterStage {
  const paymentRequired =
    row.financialDisplayState === "UNPAID" || row.financialDisplayState === "PARTIALLY_PAID";
  if (row.isFinalParticipant && paymentRequired) {
    return "final_open_payment";
  }
  if (paymentRequired) {
    return "approved_payment_required";
  }
  return row.isFinalParticipant ? "final_ready" : "approved_ready_to_finalize";
}

export type TourOperationalRosterResponse = {
  readonly tourId: string;
  readonly filter: OperationalRosterFilter;
  readonly items: readonly TourOperationalRosterRow[];
  readonly total: number;
  readonly nextCursor: string | null;
  readonly capacitySummary?: {
    readonly capacityMax: number | null;
    readonly approvedParticipants: number;
    readonly remainingTourSeats: number | null;
    readonly approvedDriverOffers: number;
    readonly approvedDongParticipants: number;
    readonly remainingDongSeats: number;
    readonly waitlistedDongParticipants: number;
    readonly pendingParticipants: number;
    readonly pendingDongParticipants: number;
    readonly pendingDriverOffers: number;
    readonly dongWaitlistBlockedByCarSeats: boolean;
  };
  readonly transportParticipants?: readonly TourTransportParticipant[];
};

export type TourTransportParticipant = {
  readonly registrationId: string;
  readonly guestLabel: string;
  readonly partySize: number;
  readonly transportKind: string | null;
  readonly personalCarOccupants: number | null;
};

export type TourTransportAllocationInput = {
  readonly driverRegistrationId: string;
  readonly passengerRegistrationId: string;
};

export function buildTourTransportAllocations(
  assignments: Readonly<Record<string, string>>
): TourTransportAllocationInput[] {
  return Object.entries(assignments)
    .filter(([, driverRegistrationId]) => driverRegistrationId.length > 0)
    .map(([passengerRegistrationId, driverRegistrationId]) => ({
      driverRegistrationId,
      passengerRegistrationId,
    }))
    .sort(
      (a, b) =>
        a.driverRegistrationId.localeCompare(b.driverRegistrationId) ||
        a.passengerRegistrationId.localeCompare(b.passengerRegistrationId)
    );
}

export function canAssignDongParticipantToDriver(input: {
  readonly driver: TourTransportParticipant;
  readonly passenger: TourTransportParticipant;
  readonly passengerRows: readonly TourTransportParticipant[];
  readonly assignments: Readonly<Record<string, string>>;
}): boolean {
  if (
    input.driver.transportKind !== "personal_car" ||
    input.passenger.transportKind !== "no_car_dong"
  ) {
    return false;
  }
  const alreadyAssigned = input.passengerRows
    .filter(
      (passenger) =>
        passenger.registrationId !== input.passenger.registrationId &&
        input.assignments[passenger.registrationId] === input.driver.registrationId
    )
    .reduce((total, passenger) => total + Math.max(1, Math.trunc(passenger.partySize)), 0);
  return (
    alreadyAssigned + Math.max(1, Math.trunc(input.passenger.partySize)) <=
    Math.max(0, Math.trunc(input.driver.personalCarOccupants ?? 0))
  );
}

export const TOUR_WORKSPACE_TRANSPORT_TEST_IDS = {
  modes: "operator-tour-workspace-transport-modes",
  capacitySummary: "operator-tour-workspace-transport-capacity-summary",
  modeCounts: "operator-tour-workspace-transport-mode-counts",
  table: "operator-tour-workspace-transport-table",
  mobileList: "operator-tour-workspace-transport-mobile-list",
  empty: "operator-tour-workspace-transport-empty",
  controls: "operator-tour-workspace-transport-controls",
  filters: "operator-tour-workspace-operational-roster-filters",
  filtersToggle: "operator-tour-workspace-transport-filters-toggle",
  filtersPanel: "operator-tour-workspace-transport-filters-panel",
  activeFilters: "operator-tour-workspace-transport-active-filters",
  finalBadge: "operator-tour-workspace-operational-roster-final",
  finalizeParticipantButton: "operator-tour-workspace-finalize-participant",
  cancelParticipantButton: "operator-tour-workspace-cancel-participant",
  amountDue: "operator-tour-workspace-operational-roster-amount-due",
  paymentDeadline: "operator-tour-workspace-operational-roster-deadline",
  driverBadge: "operator-tour-workspace-operational-roster-driver",
  rowAvatar: "operator-tour-workspace-operational-roster-avatar",
  settlementPanel: "operator-tour-workspace-driver-settlement",
  carAssignment: "operator-tour-workspace-car-assignment",
  saveAllocationsButton: "operator-tour-workspace-save-car-assignments",
  settlementTotal: "operator-tour-workspace-driver-settlement-total",
  settlementStatus: "operator-tour-workspace-driver-settlement-status",
  freezeButton: "operator-tour-workspace-roster-freeze",
  approvePayableButton: "operator-tour-workspace-settlement-approve-payable",
  exportFinalRosterButton: "operator-tour-workspace-export-final-roster",
} as const;

export const OPERATIONAL_ROSTER_FILTERS: readonly OperationalRosterFilter[] = [
  "final",
  "awaiting_finalization",
  "operational",
  "unpaid",
  "paid",
  "expiring",
  "waitlist",
];

export function buildTourOperationalRosterQuery(
  tourId: string,
  filter: OperationalRosterFilter = "final",
  transportKind?: string,
  includeCapacitySummary = false
): string {
  const params = new URLSearchParams();
  params.set("view", "ops");
  params.set("filter", filter);
  if (transportKind !== undefined && transportKind.trim().length > 0) {
    params.set("transportKind", transportKind.trim());
  }
  if (includeCapacitySummary) params.set("includeCapacitySummary", "true");
  void tourId;
  return params.toString();
}

export function buildTourOperationalRosterHref(
  tourId: string,
  filter: OperationalRosterFilter = "final",
  includeCapacitySummary = false
): string {
  return `/api/tours/${encodeURIComponent(tourId)}/operational-roster?${buildTourOperationalRosterQuery(tourId, filter, undefined, includeCapacitySummary)}`;
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
  return row.currency !== null ? formatMinorAmount(digits, row.currency, "fa") : digits;
}

export function resolveOperationalRosterActionablePaymentDueAt(
  row: Pick<TourOperationalRosterRow, "financialDisplayState" | "paymentDueAt">
): string | null {
  if (
    row.financialDisplayState === "PAID" ||
    row.financialDisplayState === "WAIVED" ||
    row.financialDisplayState === "NOT_APPLICABLE"
  ) {
    return null;
  }
  return row.paymentDueAt;
}

export type OperationalRosterNoteKind =
  | "not_final"
  | "payment_required"
  | "payment_deadline"
  | "refund"
  | "driver"
  | "ready";

export function resolveOperationalRosterNoteKind(
  row: Pick<
    TourOperationalRosterRow,
    | "isFinalParticipant"
    | "financialDisplayState"
    | "paymentDueAt"
    | "refundDisplayState"
    | "isDriverOffer"
  >
): OperationalRosterNoteKind {
  if (!row.isFinalParticipant) {
    return row.financialDisplayState === "UNPAID" || row.financialDisplayState === "PARTIALLY_PAID"
      ? "payment_required"
      : "not_final";
  }
  if (row.refundDisplayState !== "none") {
    return "refund";
  }
  if (resolveOperationalRosterActionablePaymentDueAt(row) !== null) {
    return "payment_deadline";
  }
  return row.isDriverOffer ? "driver" : "ready";
}
