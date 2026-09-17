import { buildTicketEvent } from "../domain/events";
import { bumpTicketActivity, withIncrementedRowVersion } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import { ticketingOk, type TicketingResult } from "../domain/errors";
import { parseTicketPriority } from "../domain/validation";
import { assertRowVersion } from "./concurrency";
import type { ChangeTicketPriorityCommand, TicketMutationOutcome } from "./commands";

export function changeTicketPriority(
  command: ChangeTicketPriorityCommand,
): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("change_priority", command.actor, command.ticket);
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const priority = parseTicketPriority(command.priority);
  if (!priority.ok) return priority;

  const event = buildTicketEvent({
    id: command.eventId,
    tenantId: command.ticket.tenantId,
    ticketId: command.ticket.id,
    eventType: "ticket.priority.changed",
    actorUserId: command.actor.userId,
    payload: {
      from: command.ticket.priority,
      to: priority.value,
    },
    createdAt: command.nowIso,
  });

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(
      { ...command.ticket, priority: priority.value },
      command.nowIso,
    ),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, events: [event] });
}
