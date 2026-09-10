import { buildTicketTemplateVariableMap, isAllowedTicketTemplateVariable } from "./variables";
import { escapeHtmlText, sanitizeTicketTemplateBody } from "./sanitize";
import type { TicketTemplateChannel, TicketTemplateVariableContext } from "./types";

const TOKEN_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function findDisallowedTemplateTokens(template: string): readonly string[] {
  const disallowed = new Set<string>();
  for (const match of template.matchAll(TOKEN_RE)) {
    const name = match[1] ?? "";
    if (!isAllowedTicketTemplateVariable(name)) {
      disallowed.add(name);
    }
  }
  return [...disallowed];
}

export function interpolateTicketTemplate(
  template: string,
  context: TicketTemplateVariableContext,
  options?: { readonly escapeHtml?: boolean },
): string {
  const sanitized = sanitizeTicketTemplateBody(template);
  const vars = buildTicketTemplateVariableMap(context);
  return sanitized.replace(TOKEN_RE, (_full, rawName: string) => {
    if (!isAllowedTicketTemplateVariable(rawName)) {
      return "";
    }
    const value = vars[rawName];
    return options?.escapeHtml === true ? escapeHtmlText(value) : value;
  });
}

export function mapEventTypeToTemplateChannels(eventType: string): readonly TicketTemplateChannel[] {
  switch (eventType) {
    case "ticket.sla.warning":
      return ["sla_warning", "email", "sms"];
    case "ticket.sla.breached":
      return ["sla_breach", "email", "sms"];
    case "ticket.created":
    case "ticket.message.posted":
    case "ticket.resolved":
    case "ticket.reopened":
    case "ticket.assigned":
      return ["email", "sms"];
    default:
      return [];
  }
}
