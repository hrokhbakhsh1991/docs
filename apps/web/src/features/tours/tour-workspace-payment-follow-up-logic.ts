/** Tour workspace payment follow-up — approved roster rows with an open balance. */
import type { TourFinanceListFilter } from "@/features/tours/tour-workspace-finance-logic";
import type { TourOperationalRosterRow } from "@/features/tours/tour-workspace-transport-logic";

export type PaymentFollowUpPrimaryActionKind =
  | "open_details"
  | "none";

export type PaymentFollowUpListKind =
  | "unpaid"
  | "partial"
  | "settled";

export type TourWorkspacePaymentFollowUpParticipantRow = {
  readonly key: string;
  readonly registrationId: string;
  readonly displayName: string;
  readonly memberUserId?: string;
  readonly memberAvatarUrl?: string | null;
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  readonly remainingMinor: string | null;
  readonly amountDueNowMinor: string | null;
  readonly currency: string | null;
  readonly paymentDueAt: string | null;
  readonly isFinalParticipant: boolean;
  readonly listKind: PaymentFollowUpListKind;
  readonly primaryAction: PaymentFollowUpPrimaryActionKind;
};

export function resolvePaymentFollowUpPrimaryAction(input: {
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
}): {
  readonly primary: PaymentFollowUpPrimaryActionKind;
} {
  const status = input.registrationStatus.trim().toLowerCase();
  if (status !== "approved") {
    return { primary: "none" };
  }
  const financial = input.financialDisplayState?.trim().toUpperCase() ?? "";
  if (financial === "UNPAID" || financial === "PARTIALLY_PAID") {
    return { primary: "open_details" };
  }
  return { primary: "none" };
}

function resolveListKind(input: {
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
}): PaymentFollowUpListKind {
  if (input.registrationStatus.trim().toLowerCase() !== "approved") {
    return "settled";
  }
  const financial = input.financialDisplayState?.trim().toUpperCase() ?? "";
  if (financial === "UNPAID") {
    return "unpaid";
  }
  if (financial === "PARTIALLY_PAID") {
    return "partial";
  }
  return "settled";
}

export function mapRosterRowToFollowUpParticipant(
  row: TourOperationalRosterRow
): TourWorkspacePaymentFollowUpParticipantRow {
  const actions = resolvePaymentFollowUpPrimaryAction({
    registrationStatus: row.registrationStatus,
    financialDisplayState: row.financialDisplayState,
  });
  const bookingPaymentStatus =
    row.financialDisplayState === "PARTIALLY_PAID"
      ? "partial"
      : row.financialDisplayState === "PAID" || row.financialDisplayState === "WAIVED"
        ? "paid"
        : row.financialDisplayState === "UNPAID"
          ? "unpaid"
          : null;
  return {
    key: `roster:${row.registrationId}`,
    registrationId: row.registrationId,
    displayName: row.guestLabel,
    ...(row.memberUserId !== undefined ? { memberUserId: row.memberUserId } : {}),
    ...(row.memberAvatarUrl !== undefined ? { memberAvatarUrl: row.memberAvatarUrl } : {}),
    registrationStatus: row.registrationStatus,
    financialDisplayState: row.financialDisplayState,
    bookingPaymentStatus,
    remainingMinor: row.remainingMinor,
    amountDueNowMinor: row.amountDueNowMinor ?? null,
    currency: row.currency,
    paymentDueAt: row.paymentDueAt,
    isFinalParticipant: row.isFinalParticipant,
    listKind: resolveListKind({
      registrationStatus: row.registrationStatus,
      financialDisplayState: row.financialDisplayState,
    }),
    primaryAction: actions.primary,
  };
}

export function mergePaymentFollowUpParticipants(input: {
  readonly rosterRows: readonly TourOperationalRosterRow[];
}): readonly TourWorkspacePaymentFollowUpParticipantRow[] {
  const rows = input.rosterRows
    .map(mapRosterRowToFollowUpParticipant)
    .filter((row) => row.listKind === "unpaid" || row.listKind === "partial");
  return rows.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );
}

export function filterPaymentFollowUpParticipants(
  rows: readonly TourWorkspacePaymentFollowUpParticipantRow[],
  filter: TourFinanceListFilter,
  searchQuery: string
): readonly TourWorkspacePaymentFollowUpParticipantRow[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (row.listKind !== "unpaid" && row.listKind !== "partial") {
      return false;
    }
    if (filter === "unpaid" && row.listKind !== "unpaid") {
      return false;
    }
    if (filter === "partial" && row.listKind !== "partial") {
      return false;
    }
    if (q.length === 0) {
      return true;
    }
    return row.displayName.toLowerCase().includes(q);
  });
}

export function findPaymentFollowUpParticipant(
  rows: readonly TourWorkspacePaymentFollowUpParticipantRow[],
  registrationId: string | null
): TourWorkspacePaymentFollowUpParticipantRow | null {
  const id = registrationId?.trim() ?? "";
  if (id.length === 0) {
    return null;
  }
  return rows.find((row) => row.registrationId === id) ?? null;
}

export function paymentFollowUpPrimaryActionLabelKey(
  kind: PaymentFollowUpPrimaryActionKind
): string | null {
  switch (kind) {
    case "open_details":
      return "ctaReviewPayment";
    default:
      return null;
  }
}

export function shouldShowPaymentFollowUpDeadline(
  row: TourWorkspacePaymentFollowUpParticipantRow
): boolean {
  if (row.paymentDueAt === null || row.paymentDueAt.trim().length === 0) {
    return false;
  }
  return (
    row.listKind === "unpaid" ||
    row.listKind === "partial"
  );
}
