/**
 * Operational observation — what the current finance system does today (PR5-A).
 * Host-owned. Must not copy CaseOutput fields or embed interpreter logic.
 */

export type OperationalFollowUpOwner =
  | "finance_queue"
  | "counterparty_wait"
  | "idle"
  | "exception_bucket"
  | "product_desk"
  | "unknown";

export type OperationalFinanceCategory =
  | "awaiting_receipt"
  | "awaiting_review"
  | "settled"
  | "no_money"
  | "ineligible"
  | "other";

/**
 * Snapshot of existing operational handling for one enrollment subject.
 * Derived from booking/payment/receipt queues — not from Case interpretation.
 */
export type OperationalObservation = {
  readonly pendingReceiptQueue: boolean;
  readonly paymentPending: boolean;
  readonly bookingPaymentStatus: string | null;
  readonly bookingStatus: string | null;
  /** Closed booking with unpaid / pending proof cues (ops exception bucket). */
  readonly closedWithPossibleLeftovers: boolean;
  /** Approved (or similar) path still chasing money. */
  readonly collectionAttempted: boolean;
  readonly followUpOwner: OperationalFollowUpOwner;
  readonly financeCategory: OperationalFinanceCategory;
};

export type OperationalObservationSource = {
  readonly bookingStatus: string | null;
  readonly bookingPaymentStatus: string | null;
  readonly hasPendingManualPayment: boolean;
  readonly latestReceiptStatus: string | null;
  readonly inPendingReceiptQueue: boolean;
  /** Explicit free / zero-obligation cue from commercial policy (not Case). */
  readonly noMoneyDueCue?: boolean;
};

function isClosedBooking(status: string | null): boolean {
  if (status === null) {
    return false;
  }
  const s = status.toLowerCase();
  return s === "cancelled" || s === "rejected";
}

function isEligibleCollectionPath(status: string | null): boolean {
  if (status === null) {
    return false;
  }
  const s = status.toLowerCase();
  return s === "approved" || s === "pending" || s === "waitlisted";
}

/**
 * Pure mapping from existing SoT cues → OperationalObservation.
 * No CaseOutput / owner / posture imports.
 */
export function classifyOperationalObservation(
  source: OperationalObservationSource
): OperationalObservation {
  const closed = isClosedBooking(source.bookingStatus);
  const payment = (source.bookingPaymentStatus ?? "").toLowerCase();
  const receipt = (source.latestReceiptStatus ?? "").toLowerCase();
  const unsettled = payment === "unpaid" || payment === "partial";
  const noMoney = source.noMoneyDueCue === true;

  const closedWithPossibleLeftovers =
    closed &&
    (unsettled ||
      source.hasPendingManualPayment ||
      receipt === "pending" ||
      source.inPendingReceiptQueue);

  const collectionAttempted =
    !closed && isEligibleCollectionPath(source.bookingStatus) && unsettled && !noMoney;

  let financeCategory: OperationalFinanceCategory;
  if (noMoney) {
    financeCategory = "no_money";
  } else if (closed && !closedWithPossibleLeftovers) {
    financeCategory = "ineligible";
  } else if (payment === "paid" && receipt !== "pending" && !source.inPendingReceiptQueue) {
    financeCategory = "settled";
  } else if (source.inPendingReceiptQueue || receipt === "pending") {
    financeCategory = "awaiting_review";
  } else if (unsettled || source.hasPendingManualPayment) {
    financeCategory = "awaiting_receipt";
  } else if (closed) {
    financeCategory = "ineligible";
  } else {
    financeCategory = "other";
  }

  let followUpOwner: OperationalFollowUpOwner;
  if (closedWithPossibleLeftovers) {
    followUpOwner = "exception_bucket";
  } else if (financeCategory === "awaiting_review") {
    followUpOwner = "finance_queue";
  } else if (financeCategory === "awaiting_receipt") {
    followUpOwner = "counterparty_wait";
  } else if (financeCategory === "settled" || financeCategory === "no_money") {
    followUpOwner = "idle";
  } else if (financeCategory === "ineligible") {
    followUpOwner = "product_desk";
  } else {
    followUpOwner = "unknown";
  }

  return {
    pendingReceiptQueue: source.inPendingReceiptQueue,
    paymentPending: source.hasPendingManualPayment,
    bookingPaymentStatus: source.bookingPaymentStatus,
    bookingStatus: source.bookingStatus,
    closedWithPossibleLeftovers,
    collectionAttempted,
    followUpOwner,
    financeCategory,
  };
}
