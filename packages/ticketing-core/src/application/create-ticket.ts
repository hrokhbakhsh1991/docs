import { buildTicketEvent } from "../domain/events";
import { assertRequiredTicketFields } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import {
  DEFAULT_TICKET_PRIORITY,
  type Ticket,
  type TicketMessage,
} from "../domain/types";
import {
  ticketingErr,
  ticketingOk,
  type TicketingResult,
} from "../domain/errors";
import {
  validateBody,
  validateCategoryCode,
  validateSubject,
} from "../domain/validation";
import type { CreateTicketCommand, TicketMutationOutcome } from "./commands";

export function createTicket(command: CreateTicketCommand): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("create", command.actor);
  if (!permission.ok) return permission;

  if (command.tenantId !== command.actor.tenantId) {
    return ticketingErr("TICKET_ACCESS_DENIED", "tenantId mismatch on create");
  }
  if (command.requesterUserId !== command.actor.userId && command.actor.role === "member") {
    return ticketingErr("INVALID_TICKET_ACTOR", "member cannot create ticket for another user");
  }

  const category = validateCategoryCode(command.categoryCode);
  if (!category.ok) return category;
  const subject = validateSubject(command.subject);
  if (!subject.ok) return subject;
  const body = validateBody(command.body);
  if (!body.ok) return body;

  const priority = command.priority ?? DEFAULT_TICKET_PRIORITY;
  const nowIso = command.nowIso;

  const ticket: Ticket = {
    id: command.ticketId,
    tenantId: command.tenantId,
    ticketNumber: 0,
    ticketCode: "",
    requesterUserId: command.requesterUserId,
    assigneeUserId: null,
    assigneeTeamId: null,
    queueId: null,
    categoryCode: category.value,
    subject: subject.value,
    priority,
    status: "open",
    relatedTourId: command.relatedTourId ?? null,
    relatedRegistrationId: command.relatedRegistrationId ?? null,
    rowVersion: 1,
    lastActivityAt: nowIso,
    resolvedAt: null,
    closedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const fields = assertRequiredTicketFields(ticket);
  if (!fields.ok) return fields;

  const message: TicketMessage = {
    id: command.messageId,
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    authorUserId: command.requesterUserId,
    visibility: "public",
    body: body.value,
    createdAt: nowIso,
  };

  const createdEvent = buildTicketEvent({
    id: command.eventId,
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    eventType: "ticket.created",
    actorUserId: command.actor.userId,
    payload: {
      categoryCode: ticket.categoryCode,
      priority: ticket.priority,
      status: ticket.status,
    },
    createdAt: nowIso,
  });

  const messageEvent = buildTicketEvent({
    id: `${command.eventId}:message`,
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    eventType: "ticket.message.created",
    actorUserId: command.actor.userId,
    payload: { messageId: message.id, visibility: "public" },
    createdAt: nowIso,
  });

  return ticketingOk({
    ticket,
    message,
    events: [createdEvent, messageEvent],
  });
}
