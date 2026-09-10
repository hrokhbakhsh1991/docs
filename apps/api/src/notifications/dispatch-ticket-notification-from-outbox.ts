import { randomUUID } from "node:crypto";

import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { withTenantRls } from "../db/with-tenant-rls";
import {
  buildTicketNotificationCopy,
  type TicketNotificationEventType,
} from "../workspace-ticketing/ticket-notification-copy";
import { resolveTicketNotificationRecipientUserIds } from "../workspace-ticketing/ticket-notification-recipients";
import { applyTicketTemplateAutomation } from "../workspace-ticketing/ticket-template-automation";
import { insertMemberNotificationRow } from "./member-notification.repository";

const TICKET_NOTIFICATION_OUTBOX_TYPES = new Set<string>([
  "ticket.created",
  "ticket.message.posted",
  "ticket.internal_note.created",
  "ticket.status.changed",
  "ticket.assigned",
  "ticket.priority.changed",
  "ticket.resolved",
  "ticket.reopened",
  "ticket.sla.warning",
  "ticket.sla.breached",
  "ticket.sla.escalated",
]);

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

export async function dispatchTicketNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow,
): Promise<void> {
  if (!TICKET_NOTIFICATION_OUTBOX_TYPES.has(row.eventType)) {
    return;
  }

  const payload = asRecord(row.payload);
  const ticketId = String(payload.ticketId ?? row.aggregateId);
  const subject = String(payload.subject ?? "Ticket");
  const eventPayload = asRecord(payload.eventPayload);
  let copy = buildTicketNotificationCopy({
    eventType: row.eventType as TicketNotificationEventType,
    subject,
    payload: eventPayload,
  });

  const templated = await applyTicketTemplateAutomation({
    tenantId: row.tenantId,
    domainEventId: row.domainEventId,
    eventType: row.eventType,
    ticketId,
    locale: "en",
    context: {
      ticketId,
      ticketSubject: subject,
      categoryCode: String(payload.categoryCode ?? eventPayload.categoryCode ?? ""),
      priority: String(payload.priority ?? eventPayload.priority ?? ""),
      status: String(payload.status ?? eventPayload.status ?? ""),
      requesterUserId: String(payload.requesterUserId ?? ""),
      assigneeUserId:
        typeof payload.assigneeUserId === "string" ? payload.assigneeUserId : null,
      clock: String(eventPayload.clock ?? payload.clock ?? ""),
      escalationLevel: String(eventPayload.escalationLevel ?? payload.escalationLevel ?? ""),
      eventType: row.eventType,
    },
  });
  if (templated.body !== null) {
    copy = {
      ...copy,
      title: templated.title ?? copy.title,
      body: templated.body,
      bodyFa: templated.body,
    };
  }

  const mergedPayload = {
    ...eventPayload,
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
    subject,
    ticketId,
  };

  await withTenantRls(row.tenantId, async (tx) => {
    const recipientUserIds = await resolveTicketNotificationRecipientUserIds(tx, row.tenantId, {
      eventType: row.eventType,
      actorUserId:
        typeof payload.actorUserId === "string"
          ? payload.actorUserId
          : typeof eventPayload.actorUserId === "string"
            ? eventPayload.actorUserId
            : null,
      ticket: {
        requesterUserId: String(payload.requesterUserId ?? ""),
        assigneeUserId:
          typeof payload.assigneeUserId === "string" ? payload.assigneeUserId : null,
        assigneeTeamId:
          typeof payload.assigneeTeamId === "string" ? payload.assigneeTeamId : null,
        queueId: typeof payload.queueId === "string" ? payload.queueId : null,
      },
      payload: {
        ...eventPayload,
        authorUserId:
          typeof eventPayload.authorUserId === "string" ? eventPayload.authorUserId : null,
        assigneeUserId:
          typeof eventPayload.assigneeUserId === "string" ? eventPayload.assigneeUserId : null,
        assigneeTeamId:
          typeof eventPayload.assigneeTeamId === "string" ? eventPayload.assigneeTeamId : null,
      },
    });

    for (const userId of recipientUserIds) {
      await insertMemberNotificationRow({
        tenantId: row.tenantId,
        userId,
        sourceModule: "ticketing",
        eventType: row.eventType,
        entityType: "ticket",
        entityId: ticketId,
        title: copy.title,
        body: copy.body,
        titleKey: copy.titleKey,
        bodyKey: copy.bodyKey,
        templateKey: `ticketing.${row.eventType}`,
        dedupeKey: row.domainEventId,
        payload: mergedPayload,
        enqueueEmailSms: true,
      });
    }
  });
}

export function createTicketNotificationIdForTests(): string {
  return randomUUID();
}
