"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = { readonly registrationId: string };

export function MemberReceiptUploadForm({ registrationId }: Props) {
  const t = useTranslations("portalMember.receipt");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (file === undefined) {
      return;
    }
    setStatus("uploading");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/me/registrations/${encodeURIComponent(registrationId)}/receipt`, {
      method: "POST",
      body,
    });
    setStatus(res.ok ? "done" : "error");
  }

  return (
    <form data-portal-member-receipt-upload onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="receipt-file">
        {t("label")}
      </label>
      <input id="receipt-file" name="file" type="file" accept="image/*,.pdf" required />
      <button type="submit" className="rounded-md border px-3 py-2 text-sm">
        {t("submit")}
      </button>
      {status === "done" ? <p role="status">{t("uploaded")}</p> : null}
      {status === "error" ? <p role="alert">{t("failed")}</p> : null}
    </form>
  );
}
