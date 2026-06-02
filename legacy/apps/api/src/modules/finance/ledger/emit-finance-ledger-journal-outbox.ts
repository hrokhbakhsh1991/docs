import type { EntityManager } from "typeorm";
import type { OutboxService } from "../../outbox/outbox.service";
import { assertLedgerLinesFinanceTenantScope, normalizeFinanceTenantId } from "./ledger-tenant-scope";
import type { LedgerJournalLine } from "./ledger-journal-line";

/**
 * Transactional outbox for **finance ledger** facts (`postDoubleEntryJournal` batches).
 * Must run on the same {@link EntityManager} as the registration / payment domain write.
 *
 * **Tenant isolation:** every line’s `tenantId` must match {@link input.tenantId} (normalized); otherwise throws before enqueue.
 */
export async function emitFinanceLedgerDoubleEntryAppliedOutbox(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  tenantId: string;
  registrationId: string;
  lines: readonly LedgerJournalLine[];
  /**
   * Overrides deterministic dedupe id (default: `finance.ledger:{registrationId}:{firstLine.idempotencyKey}`).
   * Used for stable anchors such as synthetic payment-capture rows that must not collide with reversal ids.
   */
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

  await input.outboxService.addEvent(input.manager, {
    tenantId: tenantIdNorm,
    aggregateType: "FinanceLedger",
    aggregateId: primary.journalId,
    eventType: "finance.ledger.double_entry_applied",
    domainEventId,
    payload: {
      entityType: "finance_ledger_journal",
      registrationId: input.registrationId,
      journalId: primary.journalId,
      lines: input.lines.map((l) => ({
        id: l.id,
        journalId: l.journalId,
        tenantId: l.tenantId,
        account: l.account,
        side: l.side,
        amount_minor: l.amount_minor,
        currency: l.currency,
        correlationId: l.correlationId,
        idempotencyKey: l.idempotencyKey,
        createdAt: l.createdAt,
        ...(l.reversesLineId !== undefined ? { reversesLineId: l.reversesLineId } : {}),
        ...(l.metadata !== undefined ? { metadata: l.metadata } : {})
      }))
    }
  });
}
