export const TICKET_TEMPLATE_CHANNELS = [
  "public_reply",
  "internal_note",
  "email",
  "sms",
  "sla_warning",
  "sla_breach",
] as const;

export type TicketTemplateChannel = (typeof TICKET_TEMPLATE_CHANNELS)[number];

export const TICKET_TEMPLATE_LOCALES = ["en", "fa"] as const;

export type TicketTemplateLocale = (typeof TICKET_TEMPLATE_LOCALES)[number];

export const OPERATOR_ONLY_TEMPLATE_CHANNELS = new Set<TicketTemplateChannel>([
  "internal_note",
  "sla_warning",
  "sla_breach",
]);

export type TicketTemplateVariableContext = Readonly<{
  ticketId?: string | null;
  ticketSubject?: string | null;
  categoryCode?: string | null;
  priority?: string | null;
  status?: string | null;
  requesterUserId?: string | null;
  assigneeUserId?: string | null;
  clock?: string | null;
  escalationLevel?: string | number | null;
  eventType?: string | null;
}>;
