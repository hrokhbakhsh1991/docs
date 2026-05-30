import { OutboxEventEntity } from "../../../common/outbox/entities/outbox-event.entity";
import type { LedgerJournalLine } from "../ledger/ledger-journal-line";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Minor-units string suitable for triad compare. */
export function paymentAmountToMinorString(amount: string): string {
  const t = amount.trim();
  const dot = t.indexOf(".");
  if (dot === -1) {
    return t;
  }
  const frac = t.slice(dot + 1);
  if (/^0+$/.test(frac)) {
    return t.slice(0, dot);
  }
  return t;
}

export function tryParseLedgerJournalLine(
  raw: Record<string, unknown>,
  fallbackTenantId: string
): LedgerJournalLine | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const journalId = typeof raw.journalId === "string" ? raw.journalId.trim() : "";
  const tenantId =
    typeof raw.tenantId === "string" && raw.tenantId.trim() !== ""
      ? raw.tenantId.trim()
      : fallbackTenantId;
  const account = typeof raw.account === "string" ? raw.account.trim() : "";
  const side = raw.side === "debit" || raw.side === "credit" ? raw.side : null;
  const amount_minor = typeof raw.amount_minor === "string" ? raw.amount_minor.trim() : "";
  const currency = typeof raw.currency === "string" ? raw.currency.trim() : "";
  const correlationId = typeof raw.correlationId === "string" ? raw.correlationId.trim() : "";
  const idempotencyKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey.trim() : "";
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  if (
    !id ||
    !journalId ||
    !tenantId ||
    !account ||
    !side ||
    !amount_minor ||
    !currency ||
    !correlationId ||
    !idempotencyKey ||
    !createdAt
  ) {
    return null;
  }
  const line: LedgerJournalLine = {
    id,
    journalId,
    tenantId,
    account,
    side,
    amount_minor,
    currency,
    correlationId,
    idempotencyKey,
    createdAt,
  };
  if (typeof raw.reversesLineId === "string" && raw.reversesLineId.trim() !== "") {
    (line as { reversesLineId?: string }).reversesLineId = raw.reversesLineId.trim();
  }
  if (isRecord(raw.metadata)) {
    line.metadata = raw.metadata;
  }
  return line;
}

export function ledgerLinesFromFinanceOutboxRows(
  rows: readonly OutboxEventEntity[],
  tenantId: string
): LedgerJournalLine[] {
  const out: LedgerJournalLine[] = [];
  for (const row of rows) {
    if (row.eventType !== "finance.ledger.double_entry_applied") {
      continue;
    }
    const lines = row.payload.lines;
    if (!Array.isArray(lines)) {
      continue;
    }
    for (const item of lines) {
      if (!isRecord(item)) {
        continue;
      }
      const line = tryParseLedgerJournalLine(item, tenantId);
      if (line) {
        out.push(line);
      }
    }
  }
  return out;
}
