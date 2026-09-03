import type { Prisma } from "@prisma/client";

import type { Ticket, TicketEvent } from "@app-tour/ticketing-core";
import { appendAuditEvent } from "../audit/audit-logger";

export async function appendTicketingAuditEvents(
  tx: Prisma.TransactionClient,
  ticket: Ticket,
  events: readonly TicketEvent[],
  actorUserId: string | null,
): Promise<void> {
  for (const event of events) {
    await appendAuditEvent(tx, {
      action: `ticket.${event.eventType.replace(/^ticket\./, "")}`,
      entityType: "ticket",
      entityId: ticket.id,
      metadata: {
        ticketId: ticket.id,
        eventType: event.eventType,
        status: ticket.status,
        priority: ticket.priority,
        payload: event.payload,
      },
      createdAt: new Date(event.createdAt),
    });
  }
  void actorUserId;
}
