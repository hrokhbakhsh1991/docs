import type { TicketPriority, TicketStatus } from "@app-tour/ticketing-http-contracts";

export function formatMemberTicketDateTime(iso: string, locale: string): string {
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

const TICKET_OP_SMOKE_SUBJECT_PATTERN = /^TKT-OP-SMOKE[-_]/i;

export function isTicketCodeLikeSubject(subject: string, ticketCode: string): boolean {
  const normalizedSubject = subject.trim();
  if (normalizedSubject.length === 0) {
    return true;
  }
  if (normalizedSubject === ticketCode.trim()) {
    return true;
  }
  return TICKET_OP_SMOKE_SUBJECT_PATTERN.test(normalizedSubject);
}

export function resolveTicketDisplaySubject(
  subject: string,
  ticketCode: string,
  fallbackTitle: string
): string {
  if (isTicketCodeLikeSubject(subject, ticketCode)) {
    return fallbackTitle;
  }
  return subject.trim();
}
