import { changeTicketStatus } from "./change-status";
import type { CloseTicketCommand, TicketMutationOutcome } from "./commands";
import type { TicketingResult } from "../domain/errors";

export function closeTicket(command: CloseTicketCommand): TicketingResult<TicketMutationOutcome> {
  return changeTicketStatus({
    eventId: command.eventId,
    ticket: command.ticket,
    status: "closed",
    actor: command.actor,
    expectedRowVersion: command.expectedRowVersion,
    nowIso: command.nowIso,
  });
}
