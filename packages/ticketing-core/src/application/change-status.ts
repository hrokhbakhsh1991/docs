import { buildTicketEvent } from "../domain/events";
import {
  applyStatusTimestamps,
  mapActorRoleToTransitionActors,
  transitionTicketStatus,
} from "../domain/lifecycle";
import { bumpTicketActivity, withIncrementedRowVersion } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import { ticketingErr, ticketingOk, type TicketingResult } from "../domain/errors";
import { assertRowVersion } from "./concurrency";
import type { ChangeTicketStatusCommand, TicketMutationOutcome } from "./commands";

export function changeTicketStatus(
  command: ChangeTicketStatusCommand,
): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission(
    "change_status",
    command.actor,
    command.ticket,
    { toStatus: command.status },
  );
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const actors = mapActorRoleToTransitionActors(command.actor.role);
  const transitionActor = actors.find((actor) =>
    actors.length > 0
      ? (() => {
          try {
            transitionTicketStatus(command.ticket.status, command.status, actor);
            return true;
          } catch {
            return false;
          }
        })()
      : false,
  );

  if (transitionActor === undefined) {
    return ticketingErr(
      "INVALID_STATUS_TRANSITION",
      `cannot transition ${command.ticket.status} → ${command.status}`,
      "status",
    );
  }

  transitionTicketStatus(command.ticket.status, command.status, transitionActor);
  const timestamps = applyStatusTimestamps(command.ticket, command.status, command.nowIso);

  const eventType =
    command.status === "closed"
      ? "ticket.closed"
      : command.status === "open" &&
          (command.ticket.status === "resolved" || command.ticket.status === "closed")
        ? "ticket.reopened"
        : "ticket.status.changed";

  const event = buildTicketEvent({
    id: command.eventId,
    tenantId: command.ticket.tenantId,
    ticketId: command.ticket.id,
    eventType,
    actorUserId: command.actor.userId,
    payload: {
      from: command.ticket.status,
      to: command.status,
    },
    createdAt: command.nowIso,
  });

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(
      {
        ...command.ticket,
        status: command.status,
        ...timestamps,
      },
      command.nowIso,
    ),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, events: [event] });
}
