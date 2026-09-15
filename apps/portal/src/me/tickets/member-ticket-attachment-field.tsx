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
  readonly onFileSelected?: (file: File | null) => void;
  readonly onUploaded?: () => void;
};

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}`;
}

const ALLOWED_TYPES = new Set<string>(TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES);

export async function uploadMemberTicketAttachment(input: {
  readonly ticketId: string;
  readonly messageId: string;
  readonly file: File;
  readonly maxBytes: number;
}): Promise<
  "ok" | "unsupportedType" | "tooLarge" | "intentFailed" | "uploadFailed" | "completeFailed"
> {
  if (!ALLOWED_TYPES.has(input.file.type)) return "unsupportedType";
  if (input.file.size > input.maxBytes) return "tooLarge";
  const intentRes = await fetch(`/api/me/tickets/${input.ticketId}/attachments/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": createIdempotencyKey() },
    body: JSON.stringify({
      messageId: input.messageId,
      originalFileName: input.file.name,
      contentType: input.file.type,
      sizeBytes: input.file.size,
    }),
  });
  const intentBody = await intentRes.json().catch(() => ({}));
  if (!intentRes.ok || typeof intentBody.attachmentId !== "string") return "intentFailed";
  const uploadRes = await fetch(
    `/api/me/tickets/${input.ticketId}/attachments/${intentBody.attachmentId}`,
    { method: "PUT", headers: { "Content-Type": input.file.type }, body: input.file }
  );
  if (!uploadRes.ok) return "uploadFailed";
  const completeRes = await fetch(
    `/api/me/tickets/${input.ticketId}/messages/${input.messageId}/attachments/${intentBody.attachmentId}/complete`,
    { method: "POST", headers: { "Idempotency-Key": createIdempotencyKey() } }
  );
  return completeRes.ok ? "ok" : "completeFailed";
}

export function MemberTicketAttachmentField({
  mode,
  ticketId,
  messageId,
  maxBytes,
  onMessageId,
  onFileSelected,
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
    onFileSelected?.(next);
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
    try {
      const result = await uploadMemberTicketAttachment({ ticketId, messageId, file, maxBytes });
      if (result !== "ok") {
        setError(t(result));
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
