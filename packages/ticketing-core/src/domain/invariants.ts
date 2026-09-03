/**
 * Domain invariants — fail-closed checks (TKT-001 Phase 2).
 */
import { ticketingErr, ticketingOk, type TicketingResult } from "./errors";
import type { Ticket, TicketActorContext, TicketMessage, TicketMessageVisibility } from "./types";

export function assertTicketTenantMatch(
  ticket: Ticket,
  tenantId: string,
): TicketingResult<void> {
  if (ticket.tenantId !== tenantId) {
    return ticketingErr("TICKET_ACCESS_DENIED", "ticket tenant does not match actor tenant");
  }
  return ticketingOk(undefined);
}

export function assertMemberOwnsTicket(
  ticket: Ticket,
  actorUserId: string,
): TicketingResult<void> {
  if (ticket.requesterUserId !== actorUserId) {
    return ticketingErr(
      "MEMBER_TICKET_OWNERSHIP_REQUIRED",
      "member may only access own tickets",
    );
  }
  return ticketingOk(undefined);
}

export function assertAssigneeInTenant(
  assigneeUserId: string | null,
  tenantMemberUserIds: readonly string[] | undefined,
): TicketingResult<void> {
  if (assigneeUserId === null) {
    return ticketingOk(undefined);
  }
  if (tenantMemberUserIds === undefined) {
    return ticketingErr(
      "ASSIGNEE_NOT_IN_TENANT",
      "tenant membership list required to validate assignee",
    );
  }
  if (!tenantMemberUserIds.includes(assigneeUserId)) {
    return ticketingErr("ASSIGNEE_NOT_IN_TENANT", "assignee is not a member of the tenant");
  }
  return ticketingOk(undefined);
}

export function assertTicketNotClosedForReply(ticket: Ticket): TicketingResult<void> {
  if (ticket.status === "closed") {
    return ticketingErr("TICKET_CLOSED", "ticket is closed");
  }
  return ticketingOk(undefined);
}

export function assertInternalVisibilityAllowed(
  visibility: TicketMessageVisibility,
  authorRole: import("./types").TicketAuthorRole,
): TicketingResult<void> {
  if (visibility === "internal" && authorRole === "member") {
    return ticketingErr("INTERNAL_NOTE_FORBIDDEN", "members cannot create internal notes");
  }
  return ticketingOk(undefined);
}

export function assertMemberCannotForgeVisibility(
  requestedVisibility: TicketMessageVisibility | undefined,
  actorRole: import("./types").TicketActorRole,
): TicketingResult<void> {
  if (requestedVisibility === undefined) {
    return ticketingOk(undefined);
  }
  if (actorRole === "member" || actorRole === "viewer") {
    return ticketingErr("INVALID_VISIBILITY", "members cannot set message visibility");
  }
  return ticketingOk(undefined);
}

export function assertWorkspaceTicketingEnabled(
  ctx: TicketActorContext,
): TicketingResult<void> {
  if (ctx.workspaceTicketingEnabled === false) {
    return ticketingErr("TICKET_MODULE_DISABLED", "ticketing is disabled for this workspace");
  }
  return ticketingOk(undefined);
}

export function assertRequiredTicketFields(ticket: Ticket): TicketingResult<void> {
  if (!ticket.tenantId.trim()) {
    return ticketingErr("TENANT_CONTEXT_REQUIRED", "ticket.tenantId is required");
  }
  if (!ticket.requesterUserId.trim()) {
    return ticketingErr("INVALID_TICKET_ACTOR", "ticket.requesterUserId is required");
  }
  return ticketingOk(undefined);
}

export function bumpTicketActivity(
  ticket: Ticket,
  nowIso: string,
): Ticket {
  return {
    ...ticket,
    lastActivityAt: nowIso,
    updatedAt: nowIso,
  };
}

export function withIncrementedRowVersion(ticket: Ticket, nowIso: string): Ticket {
  return {
    ...ticket,
    rowVersion: ticket.rowVersion + 1,
    updatedAt: nowIso,
  };
}

export function deriveTicketActivityTimestamp(
  ticket: Ticket,
  nowIso: string,
): string {
  return nowIso > ticket.lastActivityAt ? nowIso : ticket.lastActivityAt;
}

export function assertMessageBelongsToTicket(
  message: TicketMessage,
  ticket: Ticket,
): TicketingResult<void> {
  if (message.ticketId !== ticket.id) {
    return ticketingErr("TICKET_ACCESS_DENIED", "message does not belong to ticket");
  }
  if (message.tenantId !== ticket.tenantId) {
    return ticketingErr("TICKET_ACCESS_DENIED", "message tenant does not match ticket");
  }
  return ticketingOk(undefined);
}
