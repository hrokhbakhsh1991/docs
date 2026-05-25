import {
  LedgerEntrySchema,
  type LedgerEntry,
  type LedgerJournal,
} from "@repo/shared-contracts";
import type { LedgerJournalLineEntity } from "./entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "./ledger-journal-line.mapper";
import type { LedgerJournalLine } from "./ledger-journal-line";

function toIsoDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return new Date(0).toISOString();
}

function toPositiveAmountMinorString(value: unknown): string {
  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : "1";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? String(n) : "1";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed) && trimmed !== "0") {
      return trimmed;
    }
  }
  return "1";
}

function toCurrencyCode(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed.toUpperCase();
    }
  }
  return "USD";
}

/**
 * Maps a domain {@link LedgerJournalLine} to the wire {@link LedgerEntry} shape (no Zod parse).
 */
export function toLedgerEntry(line: LedgerJournalLine): LedgerEntry {
  const entry: LedgerEntry = {
    id: line.id,
    journalId: line.journalId,
    tenantId: line.tenantId,
    accountId: line.account.trim(),
    side: line.side,
    amountMinor: toPositiveAmountMinorString(line.amount_minor),
    currency: toCurrencyCode(line.currency),
    correlationId: line.correlationId.trim(),
    idempotencyKey: line.idempotencyKey.trim(),
    createdAt: toIsoDateTimeString(line.createdAt),
  };
  if (line.reversesLineId !== undefined && line.reversesLineId !== null) {
    entry.reversesLineId = line.reversesLineId;
  }
  if (line.metadata !== undefined) {
    entry.metadata = line.metadata;
  }
  return entry;
}

/** Maps a persisted {@link LedgerJournalLineEntity} via the existing domain mapper. */
export function toLedgerEntryFromEntity(row: LedgerJournalLineEntity): LedgerEntry {
  return toLedgerEntry(ledgerJournalLineEntityToDomain(row));
}

/** Strict validation — throws {@link ZodError} on contract mismatch. */
export function validateLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return LedgerEntrySchema.parse(entry);
}

/** Maps domain lines to {@link LedgerJournal} (used by strict enforcement before persist). */
export function toLedgerJournalContractStrict(lines: readonly LedgerJournalLine[]): LedgerJournal {
  if (lines.length === 0) {
    throw new Error("LEDGER_JOURNAL_LINES_REQUIRED: at least one line is required");
  }
  const entries = lines.map((line) => toLedgerEntry(line));
  return {
    journalId: entries[0]!.journalId,
    tenantId: entries[0]!.tenantId,
    lines: entries,
  };
}
