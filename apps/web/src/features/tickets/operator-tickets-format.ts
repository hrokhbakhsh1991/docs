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
