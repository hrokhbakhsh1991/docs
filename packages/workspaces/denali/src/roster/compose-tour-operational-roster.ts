/**
 * DP-2 — compose tour operational roster rows from authoritative sources.
 */
import type { BookingListItem, BookingStatus } from "@app-tour/booking-http-contracts";

import type { TourOperationalRosterRow } from "./operational-roster-contract";
import type { OperationalRosterFilter } from "./operational-roster-contract";
import {
  compareOperationalRosterParticipantOrder,
  compareOperationalRosterWaitlistOrder,
  deriveFinancialDisplayState,
  deriveRefundDisplayState,
  isDriverOffer,
  isFinalParticipant,
  isFinanciallySettled,
  isOperationalParticipant,
  isPaymentDeadlineExpiringSoon,
  isWaitlisted,
  occupiesCapacity,
  passengerAssignmentStatus,
  parseMinorUnits,
  type OperationalRosterLifecycleStatus,
} from "./operational-roster-semantics";

export type ComposeTourOperationalRosterInvoice = {
  readonly remainingMinor: string;
  readonly paidAmountMinor: string;
  readonly invoiceTotalMinor: string;
  readonly currency: string;
};

export type ComposeTourOperationalRosterHold = {
  readonly status: string;
  readonly dueAt: string;
};

export type ComposeTourOperationalRosterInput = {
  readonly booking: BookingListItem;
  readonly invoice: ComposeTourOperationalRosterInvoice | null;
  readonly hold: ComposeTourOperationalRosterHold | null;
  readonly refundStatuses: readonly string[];
  readonly nowIso: string;
};

function toLifecycleStatus(status: BookingStatus): OperationalRosterLifecycleStatus {
  if (
    status === "pending" ||
    status === "approved" ||
    status === "waitlisted" ||
    status === "rejected" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "pending";
}

function deriveWaivedFlag(invoice: ComposeTourOperationalRosterInvoice | null): boolean {
  if (invoice === null) {
    return false;
  }
  const total = parseMinorUnits(invoice.invoiceTotalMinor);
  return total !== null && total === BigInt(0);
}

export function composeTourOperationalRosterRow(
  input: ComposeTourOperationalRosterInput
): TourOperationalRosterRow {
  const registrationStatus = toLifecycleStatus(input.booking.status);
  const remainingMinor = input.invoice?.remainingMinor ?? null;
  const paidMinor = input.invoice?.paidAmountMinor ?? null;
  const currency = input.invoice?.currency ?? null;
  const waived = deriveWaivedFlag(input.invoice);
  const financiallySettled = isFinanciallySettled(remainingMinor);

  return {
    registrationId: input.booking.id,
    tourId: input.booking.tourId,
    guestLabel: input.booking.guestLabel,
    partySize: input.booking.partySize,
    registrationStatus,
    financialDisplayState: deriveFinancialDisplayState({
      status: registrationStatus,
      remainingMinor,
      paidMinor,
      waived,
    }),
    remainingMinor,
    paidMinor,
    currency,
    paymentDueAt: input.hold?.dueAt ?? input.booking.paymentDueAt ?? null,
    holdStatus: input.hold?.status ?? null,
    transportKind: input.booking.transportKind,
    personalCarOccupants: input.booking.personalCarOccupants,
    isDriverOffer: isDriverOffer(input.booking.transportKind),
    passengerAssignmentStatus: passengerAssignmentStatus(),
    refundDisplayState: deriveRefundDisplayState(input.refundStatuses),
    isFinalParticipant: isFinalParticipant({ status: registrationStatus, remainingMinor }),
    isOperationalParticipant: isOperationalParticipant(registrationStatus),
    isFinanciallySettled: financiallySettled,
    occupiesCapacity: occupiesCapacity(registrationStatus),
    departureAt: input.booking.departureAt,
    submittedAt: input.booking.submittedAt,
  };
}

export function matchesOperationalRosterFilter(
  row: TourOperationalRosterRow,
  filter: OperationalRosterFilter,
  nowIso: string
): boolean {
  switch (filter) {
    case "operational":
      return row.isOperationalParticipant;
    case "final":
      return row.isFinalParticipant;
    case "unpaid":
      return row.isOperationalParticipant && !row.isFinanciallySettled;
    case "paid":
      return row.isOperationalParticipant && row.isFinanciallySettled;
    case "expiring":
      return (
        row.isOperationalParticipant &&
        isPaymentDeadlineExpiringSoon({
          paymentDueAt: row.paymentDueAt,
          nowIso,
        })
      );
    case "waitlist":
      return isWaitlisted(row.registrationStatus);
    default:
      return true;
  }
}

export function sortOperationalRosterRows(
  rows: readonly TourOperationalRosterRow[],
  filter: OperationalRosterFilter
): TourOperationalRosterRow[] {
  const sorted = [...rows];
  if (filter === "waitlist") {
    sorted.sort((a, b) =>
      compareOperationalRosterWaitlistOrder(
        { submittedAt: a.submittedAt, registrationId: a.registrationId },
        { submittedAt: b.submittedAt, registrationId: b.registrationId }
      )
    );
    return sorted;
  }
  sorted.sort((a, b) =>
    compareOperationalRosterParticipantOrder(
      { guestLabel: a.guestLabel, registrationId: a.registrationId },
      { guestLabel: b.guestLabel, registrationId: b.registrationId }
    )
  );
  return sorted;
}

export function filterOperationalRosterRows(input: {
  readonly rows: readonly TourOperationalRosterRow[];
  readonly filter: OperationalRosterFilter;
  readonly transportKind?: TourOperationalRosterRow["transportKind"];
  readonly nowIso: string;
}): TourOperationalRosterRow[] {
  let rows = input.rows.filter((row) =>
    matchesOperationalRosterFilter(row, input.filter, input.nowIso)
  );
  if (input.transportKind !== undefined) {
    rows = rows.filter((row) => row.transportKind === input.transportKind);
  }
  return sortOperationalRosterRows(rows, input.filter);
}
