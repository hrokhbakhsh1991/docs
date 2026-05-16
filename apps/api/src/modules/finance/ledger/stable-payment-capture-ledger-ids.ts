import { createHash } from "node:crypto";

/**
 * Deterministic UUID-shaped ids so a **synthetic payment-capture journal** (same economic posting as
 * checkout / leader clearing → booking wallet) can be replayed idempotently and linked from refund
 * reversal lines via {@link LedgerJournalLine.reversesLineId}.
 */
export function stablePaymentCaptureLedgerIdentifiers(paymentId: string): {
  journalId: string;
  debitLineId: string;
  creditLineId: string;
} {
  const id = paymentId.trim();
  return {
    journalId: deterministicUuidFromSeed(`payment-ledger:journal:${id}`),
    debitLineId: deterministicUuidFromSeed(`payment-ledger:debit:${id}`),
    creditLineId: deterministicUuidFromSeed(`payment-ledger:credit:${id}`)
  };
}

function deterministicUuidFromSeed(seed: string): string {
  const h = createHash("sha256").update(seed, "utf8").digest();
  const buf = Buffer.alloc(16);
  h.copy(buf, 0, 0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
