"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";
import { useId, useState } from "react";

import { TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES } from "@app-tour/ticketing-http-contracts";

type Props = {
  readonly mode: "create" | "reply";
  readonly ticketId: string | null;
  readonly messageId: string | null;
  readonly maxBytes: number;
  readonly onMessageId?: (messageId: string) => void;
  readonly onUploaded?: () => void;
};

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}`;
}

const ALLOWED_TYPES = new Set<string>(TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES);

export function MemberTicketAttachmentField({
  mode,
  ticketId,
  messageId,
  maxBytes,
  onMessageId,
  onUploaded,
}: Props) {
  const t = useTranslations("portalMember.tickets.attachments");
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setPhase("idle");
    const next = event.target.files?.[0] ?? null;
    setFile(next);
  };

  const upload = async () => {
    if (file === null || ticketId === null || messageId === null) {
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setError(t("unsupportedType"));
      setPhase("error");
      return;
    }
    if (file.size > maxBytes) {
      setError(t("tooLarge"));
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setError(null);
    const idempotencyKey = createIdempotencyKey();
    try {
      const intentRes = await fetch(`/api/me/tickets/${ticketId}/attachments/intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          messageId,
          originalFileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const intentBody = await intentRes.json().catch(() => ({}));
      if (!intentRes.ok) {
        setError(t("intentFailed"));
        setPhase("error");
        return;
      }
      const attachmentId =
        typeof intentBody.attachmentId === "string" ? intentBody.attachmentId : null;
      if (attachmentId === null) {
        setError(t("intentFailed"));
        setPhase("error");
        return;
      }

      const uploadRes = await fetch(
        `/api/me/tickets/${ticketId}/attachments/${attachmentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        },
      );
      if (!uploadRes.ok) {
        setError(t("uploadFailed"));
        setPhase("error");
        return;
      }

      const completeRes = await fetch(
        `/api/me/tickets/${ticketId}/messages/${messageId}/attachments/${attachmentId}/complete`,
        {
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey() },
        },
      );
      if (!completeRes.ok) {
        setError(t("completeFailed"));
        setPhase("error");
        return;
      }

      setPhase("done");
      onUploaded?.();
    } catch {
      setError(t("uploadFailed"));
      setPhase("error");
    }
  };

  return (
    <div data-portal-member-ticket-attachment-field data-mode={mode}>
      <label htmlFor={inputId}>{t("label")}</label>
      <input
        id={inputId}
        type="file"
        accept={TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES.join(",")}
        onChange={onFileChange}
        disabled={phase === "uploading"}
      />
      {file !== null ? (
        <p data-portal-member-ticket-attachment-file>
          {file.name} ({Math.ceil(file.size / 1024)} KB)
        </p>
      ) : null}
      {mode === "reply" && file !== null && ticketId !== null && messageId !== null ? (
        <button type="button" onClick={upload} disabled={phase === "uploading"}>
          {phase === "uploading" ? t("uploading") : t("upload")}
        </button>
      ) : null}
      {mode === "create" && file !== null ? (
        <p data-portal-member-ticket-attachment-hint>{t("createHint")}</p>
      ) : null}
      {error !== null ? (
        <p role="alert" data-portal-member-ticket-attachment-error>
          {error}
        </p>
      ) : null}
      {phase === "done" ? (
        <p role="status" data-portal-member-ticket-attachment-success>
          {t("success")}
        </p>
      ) : null}
      {onMessageId !== undefined ? null : null}
    </div>
  );
}
