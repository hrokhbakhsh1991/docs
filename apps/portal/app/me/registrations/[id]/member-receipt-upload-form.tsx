"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { MemberReceiptStatus } from "@/me/member-receipt-status";

type Props = {
  readonly registrationId: string;
  readonly initialStatus: MemberReceiptStatus;
  readonly tripsListHref: string;
  readonly tourHref: string | null;
};

export function MemberReceiptUploadForm({
  registrationId,
  initialStatus,
  tripsListHref,
  tourHref,
}: Props) {
  const t = useTranslations("portalMember.receipt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptStatus, setReceiptStatus] = useState<MemberReceiptStatus>(initialStatus);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "error">("idle");

  async function uploadReceipt() {
    const file = fileInputRef.current?.files?.[0];
    if (file === undefined) {
      return;
    }
    setUploadPhase("uploading");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`/api/me/registrations/${encodeURIComponent(registrationId)}/receipt`, {
        method: "POST",
        body,
      });
      if (res.ok) {
        setReceiptStatus("pending");
        setUploadPhase("idle");
        return;
      }
      setUploadPhase("error");
    } catch {
      setUploadPhase("error");
    }
  }

  const actionLinks = (
    <p data-portal-member-receipt-actions>
      <a href={tripsListHref} data-portal-member-receipt-back-trips>
        {t("backToTrips")}
      </a>
      {tourHref !== null ? (
        <>
          {" · "}
          <a href={tourHref} data-portal-member-receipt-view-tour>
            {t("viewTour")}
          </a>
        </>
      ) : null}
    </p>
  );

  if (receiptStatus === "pending") {
    return (
      <div data-portal-member-receipt-waiting>
        <p role="status">
          <strong>{t("waitingTitle")}</strong>
        </p>
        <p>{t("waitingBody")}</p>
        {actionLinks}
      </div>
    );
  }

  if (receiptStatus === "paid") {
    return (
      <div data-portal-member-receipt-paid>
        <p role="status">
          <strong>{t("paidTitle")}</strong>
        </p>
        <p>{t("paidBody")}</p>
        {actionLinks}
      </div>
    );
  }

  return (
    <div data-portal-member-receipt-upload>
      {receiptStatus === "rejected" ? (
        <p role="status" data-portal-member-receipt-rejected-hint>
          {t("rejectedHint")}
        </p>
      ) : null}
      <label htmlFor="receipt-file">{t("label")}</label>
      <input
        ref={fileInputRef}
        id="receipt-file"
        name="file"
        type="file"
        accept="image/*,.pdf"
        required
        disabled={uploadPhase === "uploading"}
      />
      <button
        type="button"
        data-portal-member-receipt-submit
        disabled={uploadPhase === "uploading"}
        onClick={() => void uploadReceipt()}
      >
        {uploadPhase === "uploading" ? t("uploading") : t("submit")}
      </button>
      {uploadPhase === "error" ? (
        <p role="alert" data-portal-member-receipt-error>
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
