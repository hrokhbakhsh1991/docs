import { buildTicketEvent } from "../domain/events";
import {
  applyStatusTimestamps,
  resolveMemberMessageTargetStatus,
  transitionTicketStatus,
} from "../domain/lifecycle";
import {
  assertTicketNotClosedForReply,
  bumpTicketActivity,
  withIncrementedRowVersion,
} from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import type { Ticket, TicketMessage } from "../domain/types";
import { ticketingErr, ticketingOk, type TicketingResult } from "../domain/errors";
import { validateBody } from "../domain/validation";
import { assertRowVersion } from "./concurrency";
import type { AddPublicMessageCommand, TicketMutationOutcome } from "./commands";

function applyMemberMessageStatus(ticket: Ticket, nowIso: string): TicketingResult<Ticket> {
  const target = resolveMemberMessageTargetStatus(ticket.status);
  if (target === "TICKET_CLOSED") {
    return ticketingErr("TICKET_CLOSED", "ticket is closed");
  }

  let nextStatus = target;
  if (ticket.status === "resolved" && target === "open") {
    nextStatus = transitionTicketStatus(ticket.status, "open", "member");
  } else if (ticket.status === "pending_member" && target === "open") {
    nextStatus = transitionTicketStatus(ticket.status, "open", "member");
  }

  const timestamps = applyStatusTimestamps(ticket, nextStatus, nowIso);
  return ticketingOk({
    ...ticket,
    status: nextStatus,
    ...timestamps,
  });
}

export function addPublicMessage(
  command: AddPublicMessageCommand,
): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("reply", command.actor, command.ticket);
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const body = validateBody(command.body);
  if (!body.ok) return body;

  const closed = assertTicketNotClosedForReply(command.ticket);
  if (!closed.ok) return closed;

  let nextTicket = command.ticket;
  if (command.actor.role === "member") {
    const memberStatus = applyMemberMessageStatus(command.ticket, command.nowIso);
    if (!memberStatus.ok) return memberStatus;
    nextTicket = memberStatus.value;
  }

  const message: TicketMessage = {
    id: command.messageId,
    tenantId: nextTicket.tenantId,
    ticketId: nextTicket.id,
    authorUserId: command.actor.userId,
    visibility: "public",
    body: body.value,
    createdAt: command.nowIso,
  };

  const events = [
    buildTicketEvent({
      id: command.eventId,
      tenantId: nextTicket.tenantId,
      ticketId: nextTicket.id,
      eventType: "ticket.message.created",
      actorUserId: command.actor.userId,
      payload: { messageId: message.id, visibility: "public" },
      createdAt: command.nowIso,
    }),
  ];

  if (nextTicket.status === "open" && command.ticket.status === "resolved") {
    events.push(
      buildTicketEvent({
        id: `${command.eventId}:reopened`,
        tenantId: nextTicket.tenantId,
        ticketId: nextTicket.id,
        eventType: "ticket.reopened",
        actorUserId: command.actor.userId,
        payload: { from: "resolved", to: "open" },
        createdAt: command.nowIso,
      }),
    );
  }

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(nextTicket, command.nowIso),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, message, events });
}

export function deriveTicketActivity(ticket: Ticket, nowIso: string): Ticket {
  return bumpTicketActivity(ticket, nowIso);
}
