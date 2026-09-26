"use client";

import type { MemberReceiptStatus } from "@/me/member-receipt-status";

export const MEMBER_RECEIPT_STATUS_CHANGED_EVENT = "portal-member-receipt-status-changed";

export type MemberReceiptStatusChangedDetail = {
  readonly status: MemberReceiptStatus;
};

export function dispatchMemberReceiptStatusChanged(status: MemberReceiptStatus): void {
  window.dispatchEvent(
    new CustomEvent<MemberReceiptStatusChangedDetail>(MEMBER_RECEIPT_STATUS_CHANGED_EVENT, {
      detail: { status },
    })
  );
}
