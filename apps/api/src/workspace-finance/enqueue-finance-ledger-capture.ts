import type { FinanceOutboxWriter } from "./ports/finance-outbox-writer.port";
import type {
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
} from "./ports/finance-ledger-policy.port";

/**
 * Enqueue finance.ledger.double_entry_applied inside an open host TX.
 * Fail closed: empty lines throw (must not commit Paid/prepay without books).
 * Fail closed: blank domainEventId / journal / line ids (adapter identity stability).
 * @returns true when inserted; false on duplicate domainEventId.
 */
export async function enqueueFinanceLedgerCaptureOutbox(input: {
  readonly outboxWriter: FinanceOutboxWriter;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly capture: FinanceLedgerCapturePlan;
}): Promise<boolean> {
  const { capture } = input;
  if (capture.lines.length === 0) {
    throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
  }
  assertStableCaptureIdentities(capture);
  const tenantIdNorm = normalizeFinanceTenantId(input.tenantId);
  assertLedgerLinesFinanceTenantScope(tenantIdNorm, capture.lines);
  const primary = capture.lines[0]!;
  const journalId = capture.journalId.trim() || primary.journalId;
  const override = capture.domainEventId.trim();
  const domainRaw =
    override.length > 0
      ? override
      : `finance.ledger:${input.registrationId}:${primary.idempotencyKey}`;
  const domainEventId = domainRaw.length > 128 ? domainRaw.slice(0, 128) : domainRaw;

  return input.outboxWriter.addEvent({
    tenantId: tenantIdNorm,
    aggregateType: "FinanceLedger",
    aggregateId: journalId,
    eventType: "finance.ledger.double_entry_applied",
    domainEventId,
    payload: {
      entityType: "finance_ledger_journal",
      registrationId: input.registrationId,
      journalId,
      lines: capture.lines.map((line) => ({
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

/** Reject blank / malformed adapter identities before outbox insert. */
export function assertStableCaptureIdentities(capture: FinanceLedgerCapturePlan): void {
  if (capture.domainEventId.trim().length === 0) {
    throw new Error("FINANCE_LEDGER_IDENTITY_UNSTABLE: domainEventId required");
  }
  if (capture.journalId.trim().length === 0) {
    throw new Error("FINANCE_LEDGER_IDENTITY_UNSTABLE: journalId required");
  }
  for (let i = 0; i < capture.lines.length; i++) {
    const line = capture.lines[i]!;
    if (line.id.trim().length === 0 || line.journalId.trim().length === 0) {
      throw new Error(`FINANCE_LEDGER_IDENTITY_UNSTABLE: line[${i}] ids required`);
    }
  }
  const paymentCapture = /^payment:([0-9a-f-]{36}):ledger-capture-anchor$/i.exec(
    capture.domainEventId.trim()
  );
  if (paymentCapture) {
    const paymentId = paymentCapture[1]!;
    const meta = capture.lines[0]?.metadata;
    const metaPaymentId =
      meta !== undefined && typeof meta === "object" && typeof (meta as { paymentId?: unknown }).paymentId === "string"
        ? (meta as { paymentId: string }).paymentId
        : null;
    if (metaPaymentId !== null && metaPaymentId !== paymentId) {
      throw new Error("FINANCE_LEDGER_IDENTITY_UNSTABLE: paymentId metadata mismatch");
    }
  }
}

function normalizeFinanceTenantId(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.length === 0) {
    throw new Error("FINANCE_TENANT_ID_REQUIRED: tenant_id must be non-empty for finance scope");
  }
  return t;
}

function assertLedgerLinesFinanceTenantScope(
  envelopeTenantId: string,
  lines: readonly FinanceLedgerJournalLine[]
): void {
  const envelope = normalizeFinanceTenantId(envelopeTenantId);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineTenant = normalizeFinanceTenantId(line.tenantId);
    if (lineTenant !== envelope) {
      throw new Error(
        `FINANCE_LEDGER_TENANT_MISMATCH: line[${i}] id=${line.id} tenant_id=${lineTenant} does not match envelope tenant_id=${envelope}`
      );
    }
  }
}
