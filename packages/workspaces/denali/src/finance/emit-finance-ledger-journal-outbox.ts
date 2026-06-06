import type { LedgerJournalLine } from "./ledger-journal-line";
import {
  assertLedgerLinesFinanceTenantScope,
  normalizeFinanceTenantId,
} from "./ledger-tenant-scope";
import type { OutboxWriter } from "./outbox-writer.port";

/**
 * Transactional outbox for finance ledger facts.
 * Every line tenantId must match envelope tenantId before enqueue.
 */
export async function emitFinanceLedgerDoubleEntryAppliedOutbox(input: {
  outboxWriter: OutboxWriter;
  tenantId: string;
  registrationId: string;
  lines: readonly LedgerJournalLine[];
  domainEventIdOverride?: string | null;
}): Promise<void> {
  if (input.lines.length === 0) {
    return;
  }
  const tenantIdNorm = normalizeFinanceTenantId(input.tenantId);
  assertLedgerLinesFinanceTenantScope(tenantIdNorm, input.lines);
  const primary = input.lines[0]!;
  const override = input.domainEventIdOverride?.trim();
  const domainRaw =
    override !== undefined && override !== ""
      ? override
      : `finance.ledger:${input.registrationId}:${primary.idempotencyKey}`;
  const domainEventId = domainRaw.length > 128 ? domainRaw.slice(0, 128) : domainRaw;

  await input.outboxWriter.addEvent({
    tenantId: tenantIdNorm,
    aggregateType: "FinanceLedger",
    aggregateId: primary.journalId,
    eventType: "finance.ledger.double_entry_applied",
    domainEventId,
    payload: {
      entityType: "finance_ledger_journal",
      registrationId: input.registrationId,
      journalId: primary.journalId,
      lines: input.lines.map((line) => ({
        id: line.id,
        journalId: line.journalId,
        tenantId: line.tenantId,
        account: line.account,
        side: line.side,
        amount_minor: line.amount_minor,
        currency: line.currency,
        correlationId: line.correlationId,
        idempotencyKey: line.idempotencyKey,
        createdAt: line.createdAt,
        ...(line.reversesLineId !== undefined ? { reversesLineId: line.reversesLineId } : {}),
        ...(line.metadata !== undefined ? { metadata: line.metadata } : {}),
      })),
    },
  });
}
