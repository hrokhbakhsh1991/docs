import type { LedgerJournalLine } from "./ledger-journal-line";

/**
 * Canonical tenant id for finance invariants (matches outbox / UUID normalization elsewhere).
 */
export function normalizeFinanceTenantId(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.length === 0) {
    throw new Error("FINANCE_TENANT_ID_REQUIRED: tenant_id must be non-empty for finance scope");
  }
  return t;
}

/**
 * Ensures every ledger line belongs to the same workspace as the transactional envelope
 * (outbox row, reconciliation run, etc.). Prevents accidental cross-tenant joins or mixed batches.
 */
export function assertLedgerLinesFinanceTenantScope(
  envelopeTenantId: string,
  lines: readonly LedgerJournalLine[]
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
