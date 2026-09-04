import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { withTenantRls } from "../db/with-tenant-rls";
import { isPrismaUniqueConstraintError } from "../db/prisma-error-instance";
import {
  buildTicketNotificationCopy,
  type TicketNotificationEventType,
} from "../workspace-ticketing/ticket-notification-copy";
import { resolveTicketNotificationRecipientUserIds } from "../workspace-ticketing/ticket-notification-recipients";
import { applyTicketTemplateAutomation } from "../workspace-ticketing/ticket-template-automation";

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

function mergePayload(
  eventPayload: Readonly<Record<string, unknown>>,
  copy: ReturnType<typeof buildTicketNotificationCopy>,
  subject: string,
): Prisma.InputJsonValue {
  return {
    ...eventPayload,
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
    subject,
  };
}

async function insertNotificationRow(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly ticketId: string;
    readonly eventType: TicketNotificationEventType;
    readonly domainEventId: string;
    readonly copy: ReturnType<typeof buildTicketNotificationCopy>;
    readonly payload: Prisma.InputJsonValue;
  },
): Promise<string | null> {
  try {
    const row = await tx.ticketNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        ticketId: input.ticketId,
        eventType: input.eventType,
        title: input.copy.title,
        body: input.copy.body,
        domainEventId: input.domainEventId,
        payload: input.payload,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error: unknown) {
    if (isPrismaUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

async function enqueueChannelDeliveries(
  tx: Prisma.TransactionClient,
  tenantId: string,
  notificationId: string,
  domainEventId: string,
): Promise<void> {
  for (const channel of ["email", "sms"] as const) {
    try {
      await tx.ticketNotificationDelivery.create({
        data: {
          tenantId,
          notificationId,
          channel,
          provider: "noop",
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });
    } catch (error: unknown) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
    }
  }
  void domainEventId;
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
      const notificationId = await insertNotificationRow(tx, {
        tenantId: row.tenantId,
        userId,
        ticketId,
        eventType: row.eventType as TicketNotificationEventType,
        domainEventId: row.domainEventId,
        copy,
        payload: mergePayload(eventPayload, copy, subject),
      });
      if (notificationId !== null) {
        await enqueueChannelDeliveries(tx, row.tenantId, notificationId, row.domainEventId);
      }
    }
  });
}

export function createTicketNotificationIdForTests(): string {
  return randomUUID();
}
