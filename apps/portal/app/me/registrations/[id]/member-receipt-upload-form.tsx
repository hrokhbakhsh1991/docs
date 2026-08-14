"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { MemberReceiptStatus } from "@/me/member-receipt-status";
import type { RegistrationLifecycleStatus } from "@/me/registration-lifecycle-status";

export type MemberReceiptDueLine = {
  readonly code: "trip" | "dong" | "transport";
  readonly amountMinor: string;
};

export type MemberReceiptDue = {
  readonly currency: string;
  readonly totalMinor: string;
  readonly lines: readonly MemberReceiptDueLine[];
};

type Props = {
  readonly registrationId: string;
  readonly registrationStatus: RegistrationLifecycleStatus;
  readonly initialStatus: MemberReceiptStatus;
  readonly tripsListHref: string;
  readonly tourHref: string | null;
  readonly due: MemberReceiptDue | null;
};

function formatMinorAmount(amountMinor: string, currency: string): string {
  const digits = amountMinor.replace(/\D/g, "");
  const n = digits.length > 0 ? Number.parseInt(digits, 10) : NaN;
  if (!Number.isFinite(n)) {
    return amountMinor;
  }
  const formatted = n.toLocaleString("fa-IR");
  return currency.toUpperCase() === "IRR" ? `${formatted} ریال` : `${formatted} ${currency}`;
}

export function MemberReceiptUploadForm({
  registrationId,
  registrationStatus,
  initialStatus,
  tripsListHref,
  tourHref,
  due,
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

  const dueBlock =
    due !== null ? (
      <section data-portal-member-receipt-due>
        <h2>{t("dueTitle")}</h2>
        <p data-portal-member-receipt-due-total>
          <strong>{t("dueTotal", { amount: formatMinorAmount(due.totalMinor, due.currency) })}</strong>
        </p>
        {due.lines.length > 0 ? (
          <ul>
            {due.lines.map((line) => {
              const label =
                line.code === "trip"
                  ? t("dueLineTrip")
                  : line.code === "dong"
                    ? t("dueLineDong")
                    : t("dueLineTransport");
              return (
                <li key={line.code} data-portal-member-receipt-due-line data-due-code={line.code}>
                  {label}: {formatMinorAmount(line.amountMinor, due.currency)}
                </li>
              );
            })}
          </ul>
        ) : null}
        <p>{t("dueHint")}</p>
      </section>
    ) : null;

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

  if (registrationStatus === "rejected" || registrationStatus === "cancelled") {
    return (
      <div data-portal-member-receipt-closed>
        <p role="status">
          <strong>{t("closedTitle")}</strong>
        </p>
        <p>{t("closedBody")}</p>
        {actionLinks}
      </div>
    );
  }

  if (registrationStatus === "pending" || registrationStatus === "waitlisted") {
    return (
      <div data-portal-member-receipt-awaiting-approval>
        <p role="status">
          <strong>{t("awaitingApprovalTitle")}</strong>
        </p>
        <p>{t("awaitingApprovalBody")}</p>
        {actionLinks}
      </div>
    );
  }

  if (receiptStatus === "pending") {
    return (
      <div data-portal-member-receipt-waiting>
        {dueBlock}
        <p role="status">
          <strong>{t("waitingTitle")}</strong>
        </p>
        <p>{t("waitingBody")}</p>
        {actionLinks}
      </div>
    );
  }

  return (
    <div data-portal-member-receipt-upload>
      {dueBlock}
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
