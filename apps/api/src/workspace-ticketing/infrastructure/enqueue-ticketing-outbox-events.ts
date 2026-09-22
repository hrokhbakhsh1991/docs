import type { Prisma } from "@prisma/client";
import type { Ticket, TicketEvent, TicketMessage } from "@app-tour/ticketing-core";

import { getActiveTraceId } from "../../observability/trace-request-context";
import { enqueueOutboxEvent } from "../../outbox/enqueue-domain-event";
import { coerceTicketEventId } from "../ticketing-mappers";

/** Telegram/text delivery safety cap — well under Telegram's 4096 UTF-16 sendMessage limit. */
const MAX_DELIVERY_BODY_LENGTH = 2000;

function truncateForDelivery(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_DELIVERY_BODY_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_DELIVERY_BODY_LENGTH)}…`;
}

/**
 * The `ticket.message.created` domain event only carries a `messageId` reference
 * (the message body lives in a separate TicketMessage row) — resolve the body text
 * for delivery payloads only when it belongs to the message just persisted alongside
 * this batch of events (create-ticket / add-message call sites).
 */
function resolveEventMessageBody(
  event: TicketEvent,
  message: TicketMessage | undefined,
): string | undefined {
  if (message === undefined) {
    return undefined;
  }
  // The ticket-creation event itself carries no messageId (only the sibling
  // `ticket.message.created` event does), but a create-ticket batch always pairs
  // exactly one TicketMessage with the ticket being created, so it's safe to
  // attach that same body to the `ticket.created` delivery too.
  if (event.eventType === "ticket.created") {
    return truncateForDelivery(message.body);
  }
  const messageId = (event.payload as { messageId?: unknown }).messageId;
  if (typeof messageId !== "string" || messageId !== message.id) {
    return undefined;
  }
  return truncateForDelivery(message.body);
}

const NOTIFICATION_OUTBOX_EVENT_TYPES = new Set([
  "ticket.created",
  "ticket.message.created",
  "ticket.status.changed",
  "ticket.priority.changed",
  "ticket.assigned",
  "ticket.team.assigned",
  "ticket.reopened",
  "ticket.closed",
]);

function resolveNotificationEventType(event: TicketEvent): string | null {
  if (event.eventType === "ticket.message.created") {
    const visibility = (event.payload as { visibility?: string }).visibility;
    if (visibility === "internal") {
      return "ticket.internal_note.created";
    }
    return "ticket.message.posted";
  }
  if (event.eventType === "ticket.status.changed") {
    const to = (event.payload as { to?: string }).to;
    if (to === "resolved") {
      return "ticket.resolved";
    }
    return "ticket.status.changed";
  }
  if (event.eventType === "ticket.team.assigned") {
    return "ticket.assigned";
  }
  if (NOTIFICATION_OUTBOX_EVENT_TYPES.has(event.eventType)) {
    return event.eventType;
  }
  return null;
}

export async function enqueueTicketingOutboxEvents(
  tx: Prisma.TransactionClient,
  ticket: Ticket,
  events: readonly TicketEvent[],
  message?: TicketMessage,
): Promise<void> {
  const isTicketCreationBatch = events.some((event) => event.eventType === "ticket.created");

  for (const event of events) {
    if (isTicketCreationBatch && event.eventType === "ticket.message.created") {
      continue;
    }
    const notificationEventType = resolveNotificationEventType(event);
    if (notificationEventType === null) {
      continue;
    }
    const domainEventId = coerceTicketEventId(event.id);
    const body = resolveEventMessageBody(event, message);
    await enqueueOutboxEvent(tx, {
      tenantId: ticket.tenantId,
      aggregateType: "ticket",
      aggregateId: ticket.id,
      eventType: notificationEventType,
      domainEventId,
      correlationId: getActiveTraceId(),
      createdAt: new Date(event.createdAt),
      payload: {
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        subject: ticket.subject,
        // Delivery templates (see denali-integration.surface.ts) render this as
        // `{{createdAt}}` — must be on every event, not just `ticket.created`,
        // otherwise the placeholder is left unresolved in outgoing messages.
        createdAt: event.createdAt,
        requesterUserId: ticket.requesterUserId,
        assigneeUserId: ticket.assigneeUserId,
        assigneeTeamId: ticket.assigneeTeamId,
        queueId: ticket.queueId,
        status: ticket.status,
        priority: ticket.priority,
        actorUserId: event.actorUserId,
        sourceEventType: event.eventType,
        eventPayload: event.payload as Prisma.InputJsonValue,
        ...(body === undefined ? {} : { body }),
      },
    });
  }
}
