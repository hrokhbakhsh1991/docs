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
  if (lifecycleStatus === "pending" || lifecycleStatus === "waitlisted") {
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

  if (paymentCollection === "free") {
    return {
      tone: "complete",
      title: "statusWaivedTitle",
      body: "statusWaivedBody",
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

  if (financialDisplayState === "WAIVED") {
    return {
      tone: "complete",
      title: "statusWaivedTitle",
      body: "statusWaivedBody",
    };
  }

  if (paymentStatus.trim().toLowerCase() === "paid") {
    return {
      tone: "complete",
      title: "statusPaidTitle",
      body: "statusPaidBody",
    };
  }

  return {
    tone: "action",
    title: "statusApprovedTitle",
    body: "statusApprovedBody",
  };
}
