export const TICKET_CODE_PREFIX = "TKT";

export function formatTicketCode(ticketNumber: number): string {
  if (!Number.isInteger(ticketNumber) || ticketNumber < 1) {
    return `${TICKET_CODE_PREFIX}-000000`;
  }
  return `${TICKET_CODE_PREFIX}-${String(ticketNumber).padStart(6, "0")}`;
}

export function parseTicketCodeQuery(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const prefixed = /^TKT-(\d+)$/i.exec(trimmed);
  if (prefixed !== null) {
    const parsed = Number.parseInt(prefixed[1] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}
