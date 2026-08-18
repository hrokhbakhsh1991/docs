"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type {
  MemberReceiptPanel,
  MemberReceiptPreviewKind,
  MemberReceiptStatus,
} from "@/me/member-receipt-status";
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
  readonly initialPanel: MemberReceiptPanel;
  readonly tripsListHref: string;
  readonly tourHref: string | null;
  readonly catalogDue: MemberReceiptDue | null;
};

type ReceiptStateCardProps = {
  readonly body: string;
  readonly children?: ReactNode;
  readonly eyebrow: string;
  readonly rootProps: Record<string, string>;
  readonly title: string;
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

function isPositiveMinor(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) > BigInt(0);
  } catch {
    return false;
  }
}

function previewKindFromFile(file: File): MemberReceiptPreviewKind {
  const type = file.type.trim().toLowerCase();
  if (type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    return "image";
  }
  return "unknown";
}

function ReceiptProofPreview({
  kind,
  src,
  label,
}: {
  readonly kind: MemberReceiptPreviewKind;
  readonly src: string;
  readonly label: string;
}) {
  return (
    <figure data-portal-member-receipt-preview data-preview-kind={kind}>
      {kind === "pdf" ? (
        <iframe title={label} src={src} data-portal-member-receipt-preview-frame />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- blob/signed receipt proof
        <img src={src} alt={label} data-portal-member-receipt-preview-image />
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function ReceiptStateCard({ body, children, eyebrow, rootProps, title }: ReceiptStateCardProps) {
  return (
    <div data-portal-member-receipt-state-card {...rootProps}>
      <div data-portal-member-receipt-state-copy>
        <p data-portal-member-receipt-state-eyebrow>{eyebrow}</p>
        <p role="status" data-portal-member-receipt-state-title>
          <strong>{title}</strong>
        </p>
        <p data-portal-member-receipt-state-body>{body}</p>
      </div>
      {children}
    </div>
  );
}

export function MemberReceiptUploadForm({
  registrationId,
  registrationStatus,
  initialPanel,
  tripsListHref,
  tourHref,
  catalogDue,
}: Props) {
  const t = useTranslations("portalMember.receipt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<MemberReceiptPanel>(initialPanel);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPreviewKind, setLocalPreviewKind] = useState<MemberReceiptPreviewKind | null>(
    null
  );
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "error">("idle");

  useEffect(() => {
    return () => {
      if (localPreviewUrl !== null && localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  function replaceLocalPreview(file: File | undefined) {
    setLocalPreviewUrl((current) => {
      if (current !== null && current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return file !== undefined ? URL.createObjectURL(file) : null;
    });
    setLocalPreviewKind(file !== undefined ? previewKindFromFile(file) : null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    replaceLocalPreview(event.target.files?.[0]);
  }

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
      if (!res.ok) {
        setUploadPhase("error");
        return;
      }
      setPanel((current) => ({
        ...current,
        status: "pending",
        previewUrl: localPreviewUrl ?? current.previewUrl,
        previewKind: localPreviewKind ?? current.previewKind,
      }));
      setUploadPhase("idle");
    } catch {
      setUploadPhase("error");
    }
  }

  const actionLinks = (
    <div data-portal-member-receipt-actions>
      <a
        href={tripsListHref}
        data-portal-member-receipt-back-trips
        data-action-kind="secondary"
      >
        {t("backToTrips")}
      </a>
      {tourHref !== null ? (
        <a href={tourHref} data-portal-member-receipt-view-tour data-action-kind="primary">
          {t("viewTour")}
        </a>
      ) : null}
    </div>
  );

  const remainingMinor = panel.remainingMinor;
  const remainingDue =
    remainingMinor !== null &&
    isPositiveMinor(remainingMinor) &&
    typeof panel.currency === "string" &&
    panel.currency.length > 0
      ? remainingMinor
      : null;
  const showCatalogLines =
    catalogDue !== null &&
    remainingDue !== null &&
    (remainingDue === catalogDue.totalMinor || remainingDue === panel.obligationMinor);
  const dueCurrency = panel.currency ?? catalogDue?.currency ?? "IRR";

  const previewSrc = localPreviewUrl ?? panel.previewUrl;
  const previewKind = localPreviewKind ?? panel.previewKind;
  const previewBlock =
    previewSrc !== null && previewKind !== null ? (
      <ReceiptProofPreview kind={previewKind} src={previewSrc} label={t("previewLabel")} />
    ) : null;

  const dueBlock =
    remainingDue !== null ? (
      <section data-portal-member-receipt-due>
        <h2>{t("dueTitle")}</h2>
        <p data-portal-member-receipt-due-remaining>
          <strong>{t("dueRemaining", { amount: formatMinorAmount(remainingDue, dueCurrency) })}</strong>
        </p>
        {panel.paidMinor !== null && isPositiveMinor(panel.paidMinor) ? (
          <p data-portal-member-receipt-due-paid>
            {t("duePaid", { amount: formatMinorAmount(panel.paidMinor, dueCurrency) })}
          </p>
        ) : null}
        {showCatalogLines && catalogDue !== null && catalogDue.lines.length > 0 ? (
          <ul data-portal-member-receipt-due-list>
            {catalogDue.lines.map((line) => {
              const label =
                line.code === "trip"
                  ? t("dueLineTrip")
                  : line.code === "dong"
                    ? t("dueLineDong")
                    : t("dueLineTransport");
              return (
                <li key={line.code} data-portal-member-receipt-due-line data-due-code={line.code}>
                  {label}: {formatMinorAmount(line.amountMinor, dueCurrency)}
                </li>
              );
            })}
          </ul>
        ) : null}
        <p>{t("dueHint")}</p>
      </section>
    ) : null;

  const receiptStatus: MemberReceiptStatus = panel.status;
  const eyebrow = t("uploadEyebrow");

  if (registrationStatus === "rejected" || registrationStatus === "cancelled") {
    const closedReason = registrationStatus === "cancelled" ? "cancelled" : "rejected";
    return (
      <ReceiptStateCard
        eyebrow={eyebrow}
        rootProps={{
          "data-portal-member-receipt-closed": "",
          "data-closed-reason": closedReason,
        }}
        title={closedReason === "cancelled" ? t("cancelledTitle") : t("rejectedTitle")}
        body={closedReason === "cancelled" ? t("cancelledBody") : t("rejectedBody")}
      >
        {actionLinks}
      </ReceiptStateCard>
    );
  }

  if (registrationStatus === "pending" || registrationStatus === "waitlisted") {
    return (
      <ReceiptStateCard
        eyebrow={eyebrow}
        rootProps={{ "data-portal-member-receipt-awaiting-approval": "" }}
        title={t("awaitingApprovalTitle")}
        body={t("awaitingApprovalBody")}
      >
        {actionLinks}
      </ReceiptStateCard>
    );
  }

  if (receiptStatus === "paid") {
    return (
      <ReceiptStateCard
        eyebrow={eyebrow}
        rootProps={{ "data-portal-member-receipt-paid": "" }}
        title={t("paidTitle")}
        body={t("paidBody")}
      >
        {previewBlock}
        {actionLinks}
      </ReceiptStateCard>
    );
  }

  if (receiptStatus === "waived") {
    return (
      <ReceiptStateCard
        eyebrow={eyebrow}
        rootProps={{ "data-portal-member-receipt-waived": "" }}
        title={t("waivedTitle")}
        body={t("waivedBody")}
      >
        {actionLinks}
      </ReceiptStateCard>
    );
  }

  if (receiptStatus === "pending") {
    return (
      <ReceiptStateCard
        eyebrow={eyebrow}
        rootProps={{ "data-portal-member-receipt-waiting": "" }}
        title={t("waitingTitle")}
        body={t("waitingBody")}
      >
        {dueBlock}
        {previewBlock}
        {actionLinks}
      </ReceiptStateCard>
    );
  }

  return (
    <div data-portal-member-receipt-upload>
      <div data-portal-member-detail-section-heading>
        <p data-portal-member-receipt-upload-eyebrow>{eyebrow}</p>
        <h2>{t("label")}</h2>
        <p>{t("uploadLede")}</p>
      </div>
      {dueBlock}
      {receiptStatus === "rejected" ? (
        <p role="status" data-portal-member-receipt-rejected-hint>
          {t("rejectedHint")}
        </p>
      ) : null}
      {previewBlock}
      <div data-portal-member-receipt-upload-field>
        <label htmlFor="receipt-file">{t("label")}</label>
        <input
          ref={fileInputRef}
          id="receipt-file"
          name="file"
          type="file"
          accept="image/*,.pdf"
          required
          disabled={uploadPhase === "uploading"}
          onChange={onFileChange}
        />
        <p data-portal-member-receipt-upload-hint>{t("uploadHint")}</p>
      </div>
      <div data-portal-member-receipt-upload-actions>
        <button
          type="button"
          data-portal-member-receipt-submit
          disabled={uploadPhase === "uploading"}
          onClick={() => void uploadReceipt()}
        >
          {uploadPhase === "uploading" ? t("uploading") : t("submit")}
        </button>
      </div>
      {uploadPhase === "error" ? (
        <p role="alert" data-portal-member-receipt-error>
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
