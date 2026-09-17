const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_RE = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_RE = /javascript:/gi;

export function stripDangerousMarkup(input: string): string {
  return input
    .replace(SCRIPT_TAG_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(JAVASCRIPT_URL_RE, "");
}

export function escapeHtmlText(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeTicketTemplateBody(body: string): string {
  return stripDangerousMarkup(body.trim());
}
