/**
 * Pure field validation — no Zod (TKT-001 Phase 2).
 */
import {
  TICKET_BODY_MAX_LENGTH,
  TICKET_BODY_MIN_LENGTH,
  TICKET_CATEGORY_CODE_MAX_LENGTH,
  TICKET_CATEGORY_CODE_MIN_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_SUBJECT_MIN_LENGTH,
  type TicketPriority,
  type TicketStatus,
} from "./types";
import { ticketingErr, ticketingOk, type TicketingResult } from "./errors";

const CATEGORY_CODE_RE = /^[a-z][a-z0-9_-]*$/;

export function parseTicketStatus(value: string): TicketingResult<TicketStatus> {
  const trimmed = value.trim();
  if (!(TICKET_STATUSES as readonly string[]).includes(trimmed)) {
    return ticketingErr("INVALID_STATUS", `invalid ticket status: ${value}`, "status");
  }
  return ticketingOk(trimmed as TicketStatus);
}

export function parseTicketPriority(value: string): TicketingResult<TicketPriority> {
  const trimmed = value.trim();
  if (!(TICKET_PRIORITIES as readonly string[]).includes(trimmed)) {
    return ticketingErr("INVALID_PRIORITY", `invalid ticket priority: ${value}`, "priority");
  }
  return ticketingOk(trimmed as TicketPriority);
}

export function validateCategoryCode(value: string): TicketingResult<string> {
  const trimmed = value.trim();
  if (trimmed.length < TICKET_CATEGORY_CODE_MIN_LENGTH) {
    return ticketingErr("INVALID_CATEGORY_CODE", "categoryCode is too short", "categoryCode");
  }
  if (trimmed.length > TICKET_CATEGORY_CODE_MAX_LENGTH) {
    return ticketingErr("INVALID_CATEGORY_CODE", "categoryCode is too long", "categoryCode");
  }
  if (!CATEGORY_CODE_RE.test(trimmed)) {
    return ticketingErr(
      "INVALID_CATEGORY_CODE",
      "categoryCode must be lowercase ASCII slug",
      "categoryCode",
    );
  }
  return ticketingOk(trimmed);
}

export function validateSubject(value: string): TicketingResult<string> {
  const trimmed = value.trim();
  if (trimmed.length < TICKET_SUBJECT_MIN_LENGTH) {
    return ticketingErr("INVALID_SUBJECT", "subject is too short", "subject");
  }
  if (trimmed.length > TICKET_SUBJECT_MAX_LENGTH) {
    return ticketingErr("INVALID_SUBJECT", "subject is too long", "subject");
  }
  return ticketingOk(trimmed);
}

export function validateBody(value: string): TicketingResult<string> {
  const trimmed = value.trim();
  if (trimmed.length < TICKET_BODY_MIN_LENGTH) {
    return ticketingErr("INVALID_BODY", "body is required", "body");
  }
  if (trimmed.length > TICKET_BODY_MAX_LENGTH) {
    return ticketingErr("INVALID_BODY", "body is too long", "body");
  }
  return ticketingOk(trimmed);
}

export function assertRequiredTenantId(tenantId: string | undefined | null): TicketingResult<string> {
  const trimmed = tenantId?.trim() ?? "";
  if (trimmed.length === 0) {
    return ticketingErr("TENANT_CONTEXT_REQUIRED", "tenantId is required", "tenantId");
  }
  return ticketingOk(trimmed);
}

export function assertRequiredUserId(userId: string | undefined | null): TicketingResult<string> {
  const trimmed = userId?.trim() ?? "";
  if (trimmed.length === 0) {
    return ticketingErr("INVALID_TICKET_ACTOR", "userId is required", "userId");
  }
  return ticketingOk(trimmed);
}
