import type { TicketTemplateVariableContext } from "./types";

export const TICKET_TEMPLATE_VARIABLE_ALLOWLIST = [
  "ticketId",
  "ticketSubject",
  "categoryCode",
  "priority",
  "status",
  "requesterUserId",
  "assigneeUserId",
  "clock",
  "escalationLevel",
  "eventType",
] as const;

export type TicketTemplateVariableName = (typeof TICKET_TEMPLATE_VARIABLE_ALLOWLIST)[number];

const ALLOWED = new Set<string>(TICKET_TEMPLATE_VARIABLE_ALLOWLIST);

export function isAllowedTicketTemplateVariable(name: string): name is TicketTemplateVariableName {
  return ALLOWED.has(name);
}

export function buildTicketTemplateVariableMap(
  context: TicketTemplateVariableContext,
): Readonly<Record<TicketTemplateVariableName, string>> {
  return {
    ticketId: String(context.ticketId ?? ""),
    ticketSubject: String(context.ticketSubject ?? ""),
    categoryCode: String(context.categoryCode ?? ""),
    priority: String(context.priority ?? ""),
    status: String(context.status ?? ""),
    requesterUserId: String(context.requesterUserId ?? ""),
    assigneeUserId: String(context.assigneeUserId ?? ""),
    clock: String(context.clock ?? ""),
    escalationLevel: String(context.escalationLevel ?? ""),
    eventType: String(context.eventType ?? ""),
  };
}
