import { buildTicketEvent } from "../domain/events";
import { bumpTicketActivity, withIncrementedRowVersion } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import type { TicketMessage } from "../domain/types";
import { ticketingOk, type TicketingResult } from "../domain/errors";
import { validateBody } from "../domain/validation";
import { assertRowVersion } from "./concurrency";
import type { AddInternalNoteCommand, TicketMutationOutcome } from "./commands";

export function addInternalNote(
  command: AddInternalNoteCommand,
): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("internal_note", command.actor, command.ticket);
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const body = validateBody(command.body);
  if (!body.ok) return body;

  const message: TicketMessage = {
    id: command.messageId,
    tenantId: command.ticket.tenantId,
    ticketId: command.ticket.id,
    authorUserId: command.actor.userId,
    visibility: "internal",
    body: body.value,
    createdAt: command.nowIso,
  };

  const messageEvent = buildTicketEvent({
    id: command.eventId,
    tenantId: command.ticket.tenantId,
    ticketId: command.ticket.id,
    eventType: "ticket.internal_note.created",
    actorUserId: command.actor.userId,
    payload: { messageId: message.id },
    createdAt: command.nowIso,
  });

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(command.ticket, command.nowIso),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, message, events: [messageEvent] });
}
