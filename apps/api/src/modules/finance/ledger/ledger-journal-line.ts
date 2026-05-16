/**
 * One **immutable** ledger line (future `ledger_journal_lines` row).
 * Lines are **never** single-sided: callers must use {@link postDoubleEntryJournal} so every
 * monetary mutation is a balanced journal (≥1 debit and ≥1 credit; currently exactly two lines).
 *
 * **Append-only (system invariant)**
 * - Persisted rows: **INSERT only** — no `UPDATE`, no `DELETE`, no soft-delete that hides history.
 * - Corrections and reversals: **new** journal lines only; link the reversing line to the original
 *   via {@link LedgerJournalLine.reversesLineId} (never rewrite or remove the original row).
 */
export type LedgerPostingSide = "debit" | "credit";

export type LedgerJournalLine = {
  id: string;
  /** Groups all lines that belong to one balanced posting (double-entry). */
  journalId: string;
  /** Workspace tenant — must match transactional envelope on emit / reconciliation / wallet aggregation. */
  tenantId: string;
  /** Ledger account code (e.g. `booking:{registrationId}`, `gl:…`). */
  account: string;
  side: LedgerPostingSide;
  /** Positive magnitude in minor units (sign is expressed only via `side`). */
  amount_minor: string;
  currency: string;
  correlationId: string;
  /** Unique per line for `UNIQUE (tenant_id, idempotency_key)` when persisted. */
  idempotencyKey: string;
  /**
   * When this line is an economic reversal of a prior posted line, set to that line’s `id`.
   * The original line stays in the ledger unchanged; this field is the append-only reversal link.
   */
  reversesLineId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
