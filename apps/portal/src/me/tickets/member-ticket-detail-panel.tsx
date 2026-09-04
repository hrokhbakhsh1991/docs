"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import type { MemberTicketDetailView } from "@/me/tickets/member-tickets-bff.server";

import { MemberTicketAttachmentField } from "./member-ticket-attachment-field";

type Props = {
  readonly initialDetail: MemberTicketDetailView;
  readonly attachmentsEnabled: boolean;
  readonly maxAttachmentSizeBytes: number;
};

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `reply-${Date.now()}`;
}

export function MemberTicketDetailPanel({
  initialDetail,
  attachmentsEnabled,
  maxAttachmentSizeBytes,
}: Props) {
  const t = useTranslations("portalMember.tickets");
  const router = useRouter();
  const formId = useId();
  const bodyId = `${formId}-reply`;
  const liveRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState(initialDetail);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const status = detail.ticket.status;
  const readOnly = detail.readOnly === true;
  const composerHidden = status === "closed" || readOnly;
  const canReopen = status === "resolved" && !readOnly;

  const refreshDetail = async () => {
    const res = await fetch(`/api/me/tickets/${detail.ticket.id}`, { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const body = await res.json();
    if (body?.ok === true && body.detail !== undefined) {
      setDetail(body.detail);
    }
  };

  const onReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || composerHidden) {
      return;
    }
    if (replyBody.trim().length < 1) {
      setReplyError(t("validation.body"));
      return;
    }
    setSubmitting(true);
    setReplyError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/me/tickets/${detail.ticket.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createIdempotencyKey(),
        },
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof body?.message === "string"
            ? body.message
            : body?.code === "TICKET_CLOSED"
              ? t("errors.TICKET_CLOSED")
              : t("replyError");
        setReplyError(message);
        liveRef.current?.focus();
        setSubmitting(false);
        return;
      }
      setReplyBody("");
      setSuccessMessage(t("replySuccess"));
      await refreshDetail();
      liveRef.current?.focus();
      router.refresh();
    } catch {
      setReplyError(t("replyError"));
    } finally {
      setSubmitting(false);
    }
  };

  const onReopen = async () => {
    if (!canReopen || reopening) {
      return;
    }
    setReopening(true);
    setReplyError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/me/tickets/${detail.ticket.id}/reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createIdempotencyKey(),
        },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReplyError(typeof body?.message === "string" ? body.message : t("reopenError"));
        setReopening(false);
        return;
      }
      if (body?.ok === true && body.detail !== undefined) {
        setDetail(body.detail);
      } else {
        await refreshDetail();
      }
      setSuccessMessage(t("reopenSuccess"));
      router.refresh();
    } catch {
      setReplyError(t("reopenError"));
    } finally {
      setReopening(false);
    }
  };

  return (
    <div data-portal-member-ticket-detail data-client-ready={clientReady ? "true" : undefined}>
      <header data-portal-member-ticket-detail-header>
        <p>
          <a href="/me/tickets">{t("backToList")}</a>
        </p>
        <h1>{detail.ticket.subject}</h1>
        <div data-portal-member-ticket-detail-badges>
          <span data-portal-member-ticket-status data-status={detail.ticket.status}>
            <span aria-hidden="true">{detail.ticket.statusIcon}</span>
            {t(detail.ticket.statusLabelKey)}
          </span>
          <span data-portal-member-ticket-category>{t(detail.ticket.categoryLabelKey)}</span>
          <span data-portal-member-ticket-priority>{t(detail.ticket.priorityLabelKey)}</span>
        </div>
        <time dateTime={detail.ticket.lastActivityAt}>{detail.ticket.lastActivityLabel}</time>
      </header>

      <div
        data-portal-member-ticket-status-banner
        data-status={detail.ticket.status}
        role="status"
      >
        {t(`banners.${detail.ticket.status}`)}
      </div>

      {readOnly ? (
        <p data-portal-member-ticket-viewer-readonly role="status">
          {t("viewerReadOnlyBanner")}
        </p>
      ) : null}

      {detail.links.length > 0 ? (
        <section data-portal-member-ticket-links aria-labelledby={`${formId}-links`}>
          <h2 id={`${formId}-links`}>{t("linksTitle")}</h2>
          <ul>
            {detail.links.map((link) => (
              <li key={link.id} data-entity-type={link.entityType}>
                <span>{t(`linkTypes.${link.entityType}`)}</span>
                <code>{link.entityId}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section data-portal-member-ticket-timeline aria-labelledby={`${formId}-timeline`}>
        <h2 id={`${formId}-timeline`}>{t("timelineTitle")}</h2>
        <ol data-portal-member-ticket-messages>
          {detail.messages.map((message) => (
            <li
              key={message.id}
              data-portal-member-ticket-message
              data-author={message.isMemberAuthor ? "member" : "operator"}
            >
              <div data-portal-member-ticket-message-bubble>
                <p>{message.body}</p>
                {message.attachments.length > 0 ? (
                  <ul data-portal-member-ticket-message-attachments>
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a
                          href={`/api/me/tickets/${detail.ticket.id}/attachments/${attachment.id}`}
                          data-portal-member-ticket-attachment-link
                        >
                          {attachment.originalFileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <time dateTime={message.createdAt}>{message.createdAtLabel}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div ref={liveRef} tabIndex={-1} aria-live="polite" data-portal-member-tickets-sr-only>
        {replyError ?? successMessage}
      </div>

      {canReopen ? (
        <div data-portal-member-ticket-reopen>
          <button type="button" onClick={onReopen} disabled={reopening}>
            {reopening ? t("reopening") : t("reopen")}
          </button>
        </div>
      ) : null}

      {!composerHidden ? (
        <form
          data-portal-member-ticket-composer
          onSubmit={onReply}
          aria-label={t("composerLabel")}
        >
          {replyError !== null ? (
            <p role="alert" data-portal-member-ticket-reply-error>
              {replyError}
            </p>
          ) : null}
          <label htmlFor={bodyId} data-portal-member-tickets-sr-only>
            {t("fields.body")}
          </label>
          <textarea
            id={bodyId}
            value={replyBody}
            rows={3}
            aria-invalid={replyError !== null}
            onChange={(event) => setReplyBody(event.target.value)}
          />
          {attachmentsEnabled ? (
            <MemberTicketAttachmentField
              mode="reply"
              ticketId={detail.ticket.id}
              messageId={detail.messages.at(-1)?.id ?? null}
              maxBytes={maxAttachmentSizeBytes}
              onUploaded={refreshDetail}
            />
          ) : null}
          <button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? t("submitting") : t("sendReply")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
