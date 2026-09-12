import type { TicketPriority, TicketStatus } from "@app-tour/ticketing-http-contracts";

export function formatOperatorTicketDateTime(iso: string, locale: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  const date = new Date(parsed);
  if (locale.startsWith("fa")) {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "persian",
      numberingSystem: "arabext",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ticketStatusIcon(status: TicketStatus): string {
  switch (status) {
    case "open":
      return "●";
    case "pending_member":
      return "◷";
    case "resolved":
      return "✓";
    case "closed":
      return "■";
    default:
      return "●";
  }
}

export function ticketPriorityLabelKey(priority: TicketPriority): string {
  return `priorities.${priority}`;
}

export function ticketStatusLabelKey(status: TicketStatus): string {
  return `statuses.${status}`;
}

export function ticketCategoryLabelKey(categoryCode: string): string {
  return `categories.${categoryCode}`;
}

const TICKET_EVENT_LABEL_KEYS: Readonly<Record<string, string>> = {
  "ticket.created": "created",
  "ticket.message.created": "messageCreated",
  "ticket.internal_note.created": "internalNoteCreated",
  "ticket.status.changed": "statusChanged",
  "ticket.priority.changed": "priorityChanged",
  "ticket.assigned": "assigned",
  "ticket.team.assigned": "teamAssigned",
  "ticket.queue.changed": "queueChanged",
  "ticket.tag.added": "tagAdded",
  "ticket.tag.removed": "tagRemoved",
  "ticket.category.changed": "categoryChanged",
  "ticket.reopened": "reopened",
  "ticket.closed": "closed",
  "ticket.link.created": "linkCreated",
  "ticket.link.deleted": "linkDeleted",
};

export function ticketEventLabelKey(eventType: string): string {
  return `events.${TICKET_EVENT_LABEL_KEYS[eventType] ?? "unknown"}`;
}

export function shortenUserId(userId: string): string {
  const trimmed = userId.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}…`;
}

export function createTicketsIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
