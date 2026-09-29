"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { MemberReceiptStatus } from "@/me/member-receipt-status";
import type { RegistrationLifecycleStatus } from "@/me/registration-lifecycle-status";

import {
  MEMBER_RECEIPT_STATUS_CHANGED_EVENT,
  type MemberReceiptStatusChangedDetail,
} from "./member-receipt-status-events";

type StatusCopy = {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
};

type Props = {
  readonly lifecycleStatus: RegistrationLifecycleStatus;
  readonly paymentStatus: string;
  readonly statusLabel: string;
  readonly initialCopy: StatusCopy;
  readonly initialReceiptStatus: MemberReceiptStatus;
  readonly finalizationStatus?: "not_final" | "finalized";
};

function receiptStatusLabelKey(status: MemberReceiptStatus): string {
  switch (status) {
    case "pending":
      return "receiptStatusPending";
    case "rejected":
      return "receiptStatusRejected";
    case "paid":
      return "receiptStatusPaid";
    case "waived":
      return "receiptStatusWaived";
    default:
      return "receiptStatusNone";
  }
}

function resolveReceiptCopy(
  status: MemberReceiptStatus,
  paymentStatus: string,
  finalizationStatus?: "not_final" | "finalized"
): StatusCopy {
  if (paymentStatus.trim().toLowerCase() === "paid") {
    return { tone: "complete", title: "statusPaidTitle", body: "statusPaidBody" };
  }
  if (finalizationStatus === "finalized") {
    return {
      tone: "complete",
      title: "statusFinalizedOpenPaymentTitle",
      body: "statusFinalizedOpenPaymentBody",
    };
  }
  switch (status) {
    case "pending":
      return {
        tone: "review",
        title: "statusReceiptPendingTitle",
        body: "statusReceiptPendingBody",
      };
    case "paid":
      return paymentStatus.trim().toLowerCase() === "paid"
        ? { tone: "complete", title: "statusPaidTitle", body: "statusPaidBody" }
        : {
            tone: "complete",
            title: "statusReceiptApprovedTitle",
            body: "statusReceiptApprovedBody",
          };
    case "waived":
      return { tone: "complete", title: "statusWaivedTitle", body: "statusWaivedBody" };
    case "rejected":
      return {
        tone: "action",
        title: "statusReceiptRejectedTitle",
        body: "statusReceiptRejectedBody",
      };
    default:
      return { tone: "action", title: "statusApprovedTitle", body: "statusApprovedBody" };
  }
}

export function MemberRegistrationStatusCard({
  lifecycleStatus,
  paymentStatus,
  statusLabel,
  initialCopy,
  initialReceiptStatus,
  finalizationStatus,
}: Props) {
  const t = useTranslations("portalMember.detail");
  const [copy, setCopy] = useState(initialCopy);
  const [receiptStatus, setReceiptStatus] = useState(initialReceiptStatus);

  useEffect(() => {
    const onReceiptStatusChanged = (event: Event) => {
      const detail = (event as CustomEvent<MemberReceiptStatusChangedDetail>).detail;
      if (detail?.status === undefined) return;
      setReceiptStatus(detail.status);
      if (lifecycleStatus === "approved") {
        setCopy(resolveReceiptCopy(detail.status, paymentStatus, finalizationStatus));
      }
    };
    window.addEventListener(MEMBER_RECEIPT_STATUS_CHANGED_EVENT, onReceiptStatusChanged);
    return () =>
      window.removeEventListener(MEMBER_RECEIPT_STATUS_CHANGED_EVENT, onReceiptStatusChanged);
  }, [finalizationStatus, lifecycleStatus, paymentStatus]);

  const showReceiptBadge = lifecycleStatus === "approved" || receiptStatus !== "none";
  return (
    <section data-portal-member-detail-status-card data-status-tone={copy.tone}>
      <div data-portal-member-detail-status-copy>
        <p data-portal-member-detail-status-eyebrow>{t("statusLabel")}</p>
        <h2>{t(copy.title)}</h2>
        <p>{t(copy.body)}</p>
      </div>
      <div data-portal-member-detail-status-badges>
        <span data-portal-member-detail-status-badge>
          {t("registrationStatusBadge", { status: statusLabel })}
        </span>
        {showReceiptBadge ? (
          <span data-portal-member-detail-receipt-status-badge>
            {t(receiptStatusLabelKey(receiptStatus))}
          </span>
        ) : null}
      </div>
    </section>
  );
}
