import type { MemberReceiptStatus } from "./member-receipt-status";
import type { RegistrationLifecycleStatus } from "./registration-lifecycle-status";

export type MemberRegistrationDetailStatusCopy = {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
};

type Input = {
  readonly lifecycleStatus: RegistrationLifecycleStatus;
  readonly paymentCollection?: "offline" | "free";
  readonly paymentStatus: string;
  readonly financialDisplayState?: "WAIVED";
  readonly receiptStatus: MemberReceiptStatus;
};

/**
 * Registration/payment projection is authoritative for finality; receipt status
 * only controls the review step before the booking payment is settled.
 */
export function resolveMemberRegistrationDetailStatus({
  lifecycleStatus,
  paymentCollection,
  paymentStatus,
  financialDisplayState,
  receiptStatus,
}: Input): MemberRegistrationDetailStatusCopy {
  if (lifecycleStatus === "waitlisted") {
    return {
      tone: "waiting",
      title: "statusWaitlistedTitle",
      body: "statusWaitlistedBody",
    };
  }

  if (lifecycleStatus === "pending") {
    return {
      tone: "waiting",
      title: "statusPendingTitle",
      body: paymentCollection === "free" ? "statusPendingFreeBody" : "statusPendingBody",
    };
  }

  if (lifecycleStatus === "rejected" || lifecycleStatus === "cancelled") {
    return {
      tone: "closed",
      title: lifecycleStatus === "rejected" ? "statusRejectedTitle" : "statusCancelledTitle",
      body: lifecycleStatus === "rejected" ? "statusRejectedBody" : "statusCancelledBody",
    };
  }

  if (paymentCollection === "free" || financialDisplayState === "WAIVED") {
    return {
      tone: "complete",
      title: "statusWaivedTitle",
      body: "statusWaivedBody",
    };
  }

  // Registration payment projection is authoritative for finality. A stale
  // receipt status must not turn an already-paid registration back into a
  // receipt-review or payment action state (BUG-STG-039/072).
  if (paymentStatus.trim().toLowerCase() === "paid") {
    return {
      tone: "complete",
      title: "statusPaidTitle",
      body: "statusPaidBody",
    };
  }

  if (receiptStatus === "pending") {
    return {
      tone: "review",
      title: "statusReceiptPendingTitle",
      body: "statusReceiptPendingBody",
    };
  }

  if (receiptStatus === "rejected") {
    return {
      tone: "action",
      title: "statusReceiptRejectedTitle",
      body: "statusReceiptRejectedBody",
    };
  }

  if (receiptStatus === "paid" && paymentStatus.trim().toLowerCase() !== "paid") {
    return {
      tone: "complete",
      title: "statusReceiptApprovedTitle",
      body: "statusReceiptApprovedBody",
    };
  }

  return {
    tone: "action",
    title: "statusApprovedTitle",
    body: "statusApprovedBody",
  };
}
