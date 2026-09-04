"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { createTicketsIdempotencyKey } from "@/features/tickets/operator-tickets-format";
import type {
  OperatorTicketDetailView,
  OperatorTicketsMetaView,
} from "@/features/tickets/operator-tickets-types";
import { OPERATOR_TICKETS_TEST_IDS } from "@/features/tickets/operator-tickets-types";
import { mapOperatorTicketsMutationErrorCode } from "@/features/tickets/classify-operator-tickets-bff-error";

import { OperatorTicketsComposer } from "./operator-tickets-composer";

type Props = {
  readonly detail: OperatorTicketDetailView | null;
  readonly detailState: "idle" | "loading" | "ready" | "error";
  readonly canMutate: boolean;
  readonly meta: OperatorTicketsMetaView | null;
  readonly onDetailUpdated: (detail: OperatorTicketDetailView) => void;
  readonly onError: (messageKey: string) => void;
  readonly onRetry: () => void;
};

async function patchTicket(
  ticketId: string,
  body: Record<string, unknown>,
): Promise<OperatorTicketDetailView | null> {
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": createTicketsIdempotencyKey("ticket-patch"),
    },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as
    | { readonly ok: true; readonly detail: OperatorTicketDetailView }
    | { readonly ok: false; readonly code: string };
  if (!res.ok || !payload.ok) {
    return null;
  }
  return payload.detail;
}

export function OperatorTicketsDetailPanel({
  detail,
  detailState,
  canMutate,
  meta,
  onDetailUpdated,
  onError,
  onRetry,
}: Props) {
  const t = useTranslations("tickets");

  if (detailState === "idle") {
    return (
      <div
        data-operator-tickets-detail
        data-operator-tickets-detail-state="idle"
        data-testid={OPERATOR_TICKETS_TEST_IDS.detail}
        className="p-4 text-sm text-muted-foreground"
      >
        <p>{t("detailIdle")}</p>
      </div>
    );
  }

  if (detailState === "loading" || detail === null) {
    return (
      <div
        data-operator-tickets-detail
        data-operator-tickets-detail-state="loading"
        data-testid={OPERATOR_TICKETS_TEST_IDS.detail}
        className="p-4"
      >
        <p>{t("loadingDetail")}</p>
      </div>
    );
  }

  if (detailState === "error") {
    return (
      <div
        data-operator-tickets-detail
        data-operator-tickets-detail-state="error"
        data-testid={OPERATOR_TICKETS_TEST_IDS.detail}
        className="p-4"
        role="alert"
      >
        <p>{t("detailError")}</p>
        <Button type="button" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const publicMessages = detail.messages.filter((message) => message.visibility === "public");
  const internalMessages = detail.messages.filter((message) => message.visibility === "internal");

  const runStatus = async (status: string) => {
    const next = await patchTicket(detail.ticket.id, {
      status,
      rowVersion: detail.rowVersion,
    });
    if (next === null) {
      onError("generic");
      return;
    }
    onDetailUpdated(next);
  };

  const runPriority = async (priority: string) => {
    const next = await patchTicket(detail.ticket.id, {
      priority,
      rowVersion: detail.rowVersion,
    });
    if (next === null) {
      onError("generic");
      return;
    }
    onDetailUpdated(next);
  };

  const runAssignOperator = async (assigneeUserId: string) => {
    const res = await fetch(`/api/tickets/${detail.ticket.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createTicketsIdempotencyKey("ticket-assign"),
      },
      body: JSON.stringify({ assigneeUserId, rowVersion: detail.rowVersion }),
    });
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  const runAssignTeam = async (assigneeTeamCode: string) => {
    const res = await fetch(`/api/tickets/${detail.ticket.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createTicketsIdempotencyKey("ticket-assign-team"),
      },
      body: JSON.stringify({ assigneeTeamCode, rowVersion: detail.rowVersion }),
    });
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  const runQueue = async (queueCode: string) => {
    const res = await fetch(`/api/tickets/${detail.ticket.id}/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createTicketsIdempotencyKey("ticket-queue"),
      },
      body: JSON.stringify({ queueCode, rowVersion: detail.rowVersion }),
    });
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  const runTag = async (tagCode: string) => {
    const res = await fetch(`/api/tickets/${detail.ticket.id}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createTicketsIdempotencyKey("ticket-tag"),
      },
      body: JSON.stringify({ tagCode, rowVersion: detail.rowVersion }),
    });
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  const runRemoveTag = async (tagCode: string) => {
    const res = await fetch(
      `/api/tickets/${detail.ticket.id}/tags?tagCode=${encodeURIComponent(tagCode)}&rowVersion=${detail.rowVersion}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": createTicketsIdempotencyKey("ticket-tag-rm") },
      },
    );
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  const runReopen = async () => {
    const res = await fetch(`/api/tickets/${detail.ticket.id}/reopen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createTicketsIdempotencyKey("ticket-reopen"),
      },
      body: JSON.stringify({}),
    });
    const payload = (await res.json()) as
      | { readonly ok: true; readonly detail: OperatorTicketDetailView }
      | { readonly ok: false; readonly code: string };
    if (!res.ok || !payload.ok) {
      onError(mapOperatorTicketsMutationErrorCode(!payload.ok ? payload.code : "generic"));
      return;
    }
    onDetailUpdated(payload.detail);
  };

  return (
    <section
      data-operator-tickets-detail
      data-operator-tickets-detail-state="ready"
      data-client-ready="true"
      data-testid={OPERATOR_TICKETS_TEST_IDS.detail}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="space-y-2 border-b border-border p-4">
        <h2 className="text-lg font-semibold break-words">{detail.ticket.subject}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <OperatorStatusBadge>
            <span aria-hidden="true">{detail.ticket.statusIcon}</span> {t(detail.ticket.statusLabelKey)}
          </OperatorStatusBadge>
          <span>{t(detail.ticket.priorityLabelKey)}</span>
          <span>{t(detail.ticket.categoryLabelKey)}</span>
          <span>{detail.ticket.requesterLabel}</span>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2" data-operator-tickets-actions>
            <label className="text-xs">
              <span className="sr-only">{t("actionPriority")}</span>
              <select
                defaultValue={detail.ticket.priority}
                onChange={(event) => void runPriority(event.target.value)}
              >
                {["low", "normal", "high", "urgent"].map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priorities.${priority}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => void runStatus("resolved")}>
              {t("actionResolve")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void runStatus("closed")}>
              {t("actionClose")}
            </Button>
            {(detail.ticket.status === "resolved" || detail.ticket.status === "closed") && (
              <Button type="button" size="sm" variant="outline" onClick={() => void runReopen()}>
                {t("actionReopen")}
              </Button>
            )}
            {meta?.operators[0] !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runAssignOperator(meta.operators[0]!.userId)}
              >
                {t("actionAssignOperator")}
              </Button>
            ) : null}
            {meta?.teams[0] !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runAssignTeam(meta.teams[0]!.code)}
              >
                {t("actionAssignTeam")}
              </Button>
            ) : null}
            {meta?.queues[0] !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runQueue(meta.queues[0]!.code)}
              >
                {t("actionChangeQueue")}
              </Button>
            ) : null}
            {meta?.tags[0] !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runTag(meta.tags[0]!.code)}
              >
                {t("actionAddTag")}
              </Button>
            ) : null}
            {detail.ticket.tagCodes[0] !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runRemoveTag(detail.ticket.tagCodes[0]!)}
              >
                {t("actionRemoveTag")}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-operator-tickets-readonly-banner>
            {t("readOnlyBanner")}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 text-sm font-medium">{t("timelinePublic")}</h3>
        <ul className="mb-4 space-y-3">
          {publicMessages.map((message) => (
            <li key={message.id} data-operator-tickets-message data-visibility="public">
              <p className="text-xs text-muted-foreground">
                {message.authorLabel} · <time dateTime={message.createdAt}>{message.createdAtLabel}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-sm font-medium">{t("timelineInternal")}</h3>
        <ul className="mb-4 space-y-3">
          {internalMessages.map((message) => (
            <li key={message.id} data-operator-tickets-message data-visibility="internal">
              <p className="text-xs text-muted-foreground">
                {message.authorLabel} · <time dateTime={message.createdAt}>{message.createdAtLabel}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            </li>
          ))}
        </ul>

        {detail.events.length > 0 ? (
          <>
            <h3 className="mb-2 text-sm font-medium">{t("timelineEvents")}</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {detail.events.map((event) => (
                <li key={event.id} data-operator-tickets-event>
                  {event.eventType} · <time dateTime={event.createdAt}>{event.createdAtLabel}</time>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <OperatorTicketsComposer
        detail={detail}
        canMutate={canMutate}
        onDetailUpdated={onDetailUpdated}
        onError={onError}
      />
    </section>
  );
}
