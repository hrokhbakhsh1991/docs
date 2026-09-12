import type { Prisma } from "@prisma/client";
import type { Ticket, TicketEvent } from "@app-tour/ticketing-core";

import { getActiveTraceId } from "../../observability/trace-request-context";
import { enqueueOutboxEvent } from "../../outbox/enqueue-domain-event";
import { coerceTicketEventId } from "../ticketing-mappers";

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
): Promise<void> {
  for (const event of events) {
    const notificationEventType = resolveNotificationEventType(event);
    if (notificationEventType === null) {
      continue;
    }
    const domainEventId = coerceTicketEventId(event.id);
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
        subject: ticket.subject,
        requesterUserId: ticket.requesterUserId,
        assigneeUserId: ticket.assigneeUserId,
        assigneeTeamId: ticket.assigneeTeamId,
        queueId: ticket.queueId,
        status: ticket.status,
        priority: ticket.priority,
        actorUserId: event.actorUserId,
        sourceEventType: event.eventType,
        eventPayload: event.payload as Prisma.InputJsonValue,
      },
    });
  }
}
