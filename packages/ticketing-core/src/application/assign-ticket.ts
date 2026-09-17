import { buildTicketEvent } from "../domain/events";
import { assertAssigneeInTenant, bumpTicketActivity, withIncrementedRowVersion } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import { ticketingOk, type TicketingResult } from "../domain/errors";
import { assertRowVersion } from "./concurrency";
import type { AssignTicketCommand, TicketMutationOutcome } from "./commands";

export function assignTicket(command: AssignTicketCommand): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("assign", command.actor, command.ticket);
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const assignee = assertAssigneeInTenant(
    command.assigneeUserId,
    command.actor.tenantMemberUserIds,
  );
  if (!assignee.ok) return assignee;

  const event = buildTicketEvent({
    id: command.eventId,
    tenantId: command.ticket.tenantId,
    ticketId: command.ticket.id,
    eventType: "ticket.assigned",
    actorUserId: command.actor.userId,
    payload: {
      from: command.ticket.assigneeUserId,
      to: command.assigneeUserId,
    },
    createdAt: command.nowIso,
  });

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(
      { ...command.ticket, assigneeUserId: command.assigneeUserId },
      command.nowIso,
    ),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, events: [event] });
}
