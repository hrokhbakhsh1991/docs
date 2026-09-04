/**
 * Ticketing permission matrix — pure, fail-closed (TKT-001 §9).
 */
import { ticketingErr, ticketingOk, type TicketingResult } from "./errors";
import {
  assertMemberOwnsTicket,
  assertTicketTenantMatch,
  assertViewerTenantMembership,
  assertWorkspaceTicketingEnabled,
} from "./invariants";
import { canActorTransitionStatus } from "./lifecycle";
import type {
  Ticket,
  TicketActorContext,
  TicketPermission,
  TicketStatus,
} from "./types";

function isOperatorRole(role: TicketActorContext["role"]): boolean {
  return role === "admin" || role === "owner";
}

function isReadOnlyActor(ctx: TicketActorContext): boolean {
  return ctx.role === "viewer" || ctx.readOnly === true;
}

function deny<T>(code: import("./errors").TicketingErrorCode, message: string): TicketingResult<T> {
  return ticketingErr(code, message);
}

export function assertTenantContext(ctx: TicketActorContext): TicketingResult<void> {
  if (!ctx.tenantId?.trim()) {
    return deny("TENANT_CONTEXT_REQUIRED", "tenant context is required");
  }
  if (!ctx.userId?.trim()) {
    return deny("INVALID_TICKET_ACTOR", "actor userId is required");
  }
  if (ctx.role === "platform_admin") {
    return deny("TICKET_ACCESS_DENIED", "platform admin has no cross-tenant ticketing access");
  }
  return ticketingOk(undefined);
}

export function canReadTicket(ticket: Ticket, ctx: TicketActorContext): boolean {
  const base = assertTenantContext(ctx);
  if (!base.ok) return false;
  if (assertTicketTenantMatch(ticket, ctx.tenantId).ok === false) return false;
  if (assertWorkspaceTicketingEnabled(ctx).ok === false) return false;

  if (ctx.role === "member") {
    return assertMemberOwnsTicket(ticket, ctx.userId).ok;
  }
  if (ctx.role === "viewer") {
    return assertViewerTenantMembership(ctx).ok;
  }
  if (isOperatorRole(ctx.role)) {
    return true;
  }
  return false;
}

export function canListTicket(ctx: TicketActorContext, scope: "own" | "tenant"): boolean {
  const base = assertTenantContext(ctx);
  if (!base.ok) return false;
  if (assertWorkspaceTicketingEnabled(ctx).ok === false) return false;

  if (scope === "own") {
    return ctx.role === "member";
  }
  if (ctx.role === "viewer") {
    return assertViewerTenantMembership(ctx).ok;
  }
  return isOperatorRole(ctx.role);
}

export function canCreateTicket(ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  const base = assertTenantContext(ctx);
  if (!base.ok) return false;
  if (assertWorkspaceTicketingEnabled(ctx).ok === false) return false;
  return ctx.role === "member" || isOperatorRole(ctx.role);
}

export function canReplyToTicket(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (ticket.status === "closed") return false;
  if (ctx.role === "member" && ticket.onHold === true) return false;
  if (ctx.role === "member") {
    return assertMemberOwnsTicket(ticket, ctx.userId).ok;
  }
  return isOperatorRole(ctx.role);
}

export function canAddInternalNote(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  return isOperatorRole(ctx.role);
}

export function canChangeStatus(ticket: Ticket, ctx: TicketActorContext, to: TicketStatus): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (!isOperatorRole(ctx.role)) return false;
  return canActorTransitionStatus(ticket.status, to, ctx.role);
}

export function canChangePriority(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  return isOperatorRole(ctx.role);
}

export function canAssignTicket(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  return isOperatorRole(ctx.role);
}

export function canReopenTicket(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;

  if (ticket.status === "resolved") {
    if (ctx.role === "member") {
      return assertMemberOwnsTicket(ticket, ctx.userId).ok;
    }
    return isOperatorRole(ctx.role);
  }

  if (ticket.status === "closed") {
    return isOperatorRole(ctx.role);
  }

  return false;
}

export function canCloseTicket(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (!isOperatorRole(ctx.role)) return false;
  return canActorTransitionStatus(ticket.status, "closed", ctx.role);
}

export function canManageTicketLinks(ticket: Ticket, ctx: TicketActorContext): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  return isOperatorRole(ctx.role);
}

export function canCreateTicketLink(
  ticket: Ticket,
  ctx: TicketActorContext,
  entityType: import("./types").TicketLinkEntityType,
): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (isOperatorRole(ctx.role)) return true;
  if (ctx.role === "member" && assertMemberOwnsTicket(ticket, ctx.userId).ok) {
    return entityType === "tour" || entityType === "registration";
  }
  return false;
}

export function canUploadAttachment(
  ticket: Ticket,
  ctx: TicketActorContext,
  messageVisibility: import("./types").TicketMessageVisibility,
): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (ticket.status === "closed") return false;
  if (isOperatorRole(ctx.role)) return true;
  if (ctx.role === "member" && assertMemberOwnsTicket(ticket, ctx.userId).ok) {
    return messageVisibility === "public";
  }
  return false;
}

export function canReadAttachment(
  ticket: Ticket,
  ctx: TicketActorContext,
  attachment: import("./types").TicketAttachment,
  messageVisibility: import("./types").TicketMessageVisibility | null,
): boolean {
  if (!canReadTicket(ticket, ctx)) return false;
  if (attachment.deletedAt !== null) return false;
  if (attachment.scanStatus === "rejected" || attachment.scanStatus === "failed") {
    return false;
  }
  if (ctx.role === "member") {
    if (!assertMemberOwnsTicket(ticket, ctx.userId).ok) return false;
    if (messageVisibility !== "public") return false;
    return attachment.scanStatus === "clean";
  }
  if (ctx.role === "viewer") {
    return attachment.scanStatus === "clean";
  }
  if (isOperatorRole(ctx.role)) {
    return true;
  }
  return false;
}

export function canDeleteAttachment(
  ticket: Ticket,
  ctx: TicketActorContext,
  attachment: import("./types").TicketAttachment,
  messageVisibility: import("./types").TicketMessageVisibility | null,
): boolean {
  if (isReadOnlyActor(ctx)) return false;
  if (!canReadTicket(ticket, ctx)) return false;
  if (isOperatorRole(ctx.role)) return true;
  if (
    ctx.role === "member" &&
    assertMemberOwnsTicket(ticket, ctx.userId).ok &&
    attachment.uploadedByUserId === ctx.userId &&
    messageVisibility === "public"
  ) {
    return true;
  }
  return false;
}

export function assertTicketPermission(
  permission: TicketPermission,
  ctx: TicketActorContext,
  ticket?: Ticket,
  options?: { toStatus?: TicketStatus; listScope?: "own" | "tenant" },
): TicketingResult<void> {
  if (isReadOnlyActor(ctx) && permission !== "read" && permission !== "list") {
    return deny("TICKET_VIEWER_READ_ONLY", "viewer is read-only");
  }

  switch (permission) {
    case "read": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canReadTicket(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("TICKET_ACCESS_DENIED", "read denied");
    }
    case "list": {
      const scope = options?.listScope ?? "own";
      return canListTicket(ctx, scope)
        ? ticketingOk(undefined)
        : deny("TICKET_ACCESS_DENIED", "list denied");
    }
    case "create":
      return canCreateTicket(ctx)
        ? ticketingOk(undefined)
        : deny("TICKET_ACCESS_DENIED", "create denied");
    case "reply": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canReplyToTicket(ticket, ctx)
        ? ticketingOk(undefined)
        : ticket.onHold === true && ctx.role === "member"
          ? deny("TICKET_ON_HOLD", "ticket is on hold")
        : ticket.status === "closed"
          ? deny("TICKET_CLOSED", "ticket is closed")
          : deny("TICKET_ACCESS_DENIED", "reply denied");
    }
    case "internal_note": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canAddInternalNote(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("INTERNAL_NOTE_FORBIDDEN", "internal note denied");
    }
    case "change_status": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      if (options?.toStatus === undefined) {
        return deny("INVALID_STATUS", "target status is required");
      }
      return canChangeStatus(ticket, ctx, options.toStatus)
        ? ticketingOk(undefined)
        : deny("INVALID_STATUS_TRANSITION", "status change denied");
    }
    case "change_priority": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canChangePriority(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("TICKET_ACCESS_DENIED", "priority change denied");
    }
    case "assign": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canAssignTicket(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("TICKET_ACCESS_DENIED", "assign denied");
    }
    case "reopen": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canReopenTicket(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("INVALID_STATUS_TRANSITION", "reopen denied");
    }
    case "close": {
      if (ticket === undefined) return deny("TICKET_NOT_FOUND", "ticket is required");
      return canCloseTicket(ticket, ctx)
        ? ticketingOk(undefined)
        : deny("INVALID_STATUS_TRANSITION", "close denied");
    }
    case "archive":
      if (ctx.role !== "owner") {
        return deny("TICKET_ACCESS_DENIED", "archive denied");
      }
      return ticketingOk(undefined);
    default:
      return deny("TICKET_ACCESS_DENIED", "permission denied");
  }
}
