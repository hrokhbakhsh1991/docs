import { buildTicketEvent } from "../domain/events";
import {
  applyStatusTimestamps,
  mapActorRoleToTransitionActors,
  transitionTicketStatus,
} from "../domain/lifecycle";
import { bumpTicketActivity, withIncrementedRowVersion } from "../domain/invariants";
import { assertTicketPermission } from "../domain/permissions";
import { ticketingErr, ticketingOk, type TicketingResult } from "../domain/errors";
import { validateBody } from "../domain/validation";
import type { TicketMessage } from "../domain/types";
import { assertRowVersion } from "./concurrency";
import type { ReopenTicketCommand, TicketMutationOutcome } from "./commands";

export function reopenTicket(command: ReopenTicketCommand): TicketingResult<TicketMutationOutcome> {
  const permission = assertTicketPermission("reopen", command.actor, command.ticket);
  if (!permission.ok) return permission;

  const version = assertRowVersion(command.expectedRowVersion, command.ticket.rowVersion);
  if (!version.ok) return version;

  const actors = mapActorRoleToTransitionActors(command.actor.role);
  const transitionActor = actors.find((actor) => {
    try {
      transitionTicketStatus(command.ticket.status, "open", actor);
      return true;
    } catch {
      return false;
    }
  });

  if (transitionActor === undefined) {
    return ticketingErr(
      "INVALID_STATUS_TRANSITION",
      `cannot reopen ticket from ${command.ticket.status}`,
    );
  }

  transitionTicketStatus(command.ticket.status, "open", transitionActor);
  const timestamps = applyStatusTimestamps(command.ticket, "open", command.nowIso);

  const events = [
    buildTicketEvent({
      id: command.eventId,
      tenantId: command.ticket.tenantId,
      ticketId: command.ticket.id,
      eventType: "ticket.reopened",
      actorUserId: command.actor.userId,
      payload: { from: command.ticket.status, to: "open" },
      createdAt: command.nowIso,
    }),
  ];

  let message: TicketMessage | undefined;
  if (command.body !== undefined && command.optionalMessageId !== undefined) {
    const body = validateBody(command.body);
    if (!body.ok) return body;
    message = {
      id: command.optionalMessageId,
      tenantId: command.ticket.tenantId,
      ticketId: command.ticket.id,
      authorUserId: command.actor.userId,
      visibility: "public",
      body: body.value,
      createdAt: command.nowIso,
    };
    events.push(
      buildTicketEvent({
        id: command.optionalEventId ?? `${command.eventId}:message`,
        tenantId: command.ticket.tenantId,
        ticketId: command.ticket.id,
        eventType: "ticket.message.created",
        actorUserId: command.actor.userId,
        payload: { messageId: message.id, visibility: "public" },
        createdAt: command.nowIso,
      }),
    );
  }

  const updated = withIncrementedRowVersion(
    bumpTicketActivity(
      {
        ...command.ticket,
        status: "open",
        ...timestamps,
      },
      command.nowIso,
    ),
    command.nowIso,
  );

  return ticketingOk({ ticket: updated, events, ...(message !== undefined ? { message } : {}) });
}
