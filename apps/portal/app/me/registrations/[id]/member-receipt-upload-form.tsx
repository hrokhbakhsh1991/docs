"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type Props = { readonly registrationId: string };

export function MemberReceiptUploadForm({ registrationId }: Props) {
  const t = useTranslations("portalMember.receipt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  async function uploadReceipt() {
    const file = fileInputRef.current?.files?.[0];
    if (file === undefined) {
      return;
    }
    setStatus("uploading");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`/api/me/registrations/${encodeURIComponent(registrationId)}/receipt`, {
        method: "POST",
        body,
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div data-portal-member-receipt-upload className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="receipt-file">
        {t("label")}
      </label>
      <input
        ref={fileInputRef}
        id="receipt-file"
        name="file"
        type="file"
        accept="image/*,.pdf"
        required
      />
      <button
        type="button"
        data-portal-member-receipt-submit
        className="rounded-md border px-3 py-2 text-sm"
        onClick={() => void uploadReceipt()}
      >
        {t("submit")}
      </button>
      {status === "done" ? (
        <p role="status" data-portal-member-receipt-success>
          {t("uploaded")}
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" data-portal-member-receipt-error>
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
