import type { EntityManager } from "typeorm";
import type { LedgerJournalLine } from "./ledger-journal-line";
import type { PostDoubleEntryJournalResult } from "./post-double-entry-journal";

function signedDeltaMinor(side: "debit" | "credit", amountMinor: string): string {
  const a = BigInt(amountMinor);
  const delta = side === "credit" ? a : -a;
  return delta.toString();
}

/**
 * Durability anchor: append journal lines and atomically bump account_balances in the caller transaction.
 * Idempotent per (tenant_id, idempotency_key) — duplicate lines skip balance deltas.
 */
export async function persistLedgerJournal(
  manager: EntityManager,
  result: PostDoubleEntryJournalResult
): Promise<{ journalId: string; lines: LedgerJournalLine[]; anyLineInserted: boolean }> {
  const lines = [...result.lines];
  if (lines.length === 0) {
    return { journalId: result.journalId, lines: [], anyLineInserted: false };
  }

  let anyLineInserted = false;
  const tenantId = lines[0]!.tenantId;
  const journalId = result.journalId;

  await manager.query(
    `
    INSERT INTO ledger_journal_batches (tenant_id, journal_id, created_at)
    VALUES ($1, $2, now())
    ON CONFLICT (tenant_id, journal_id) DO NOTHING
    `,
    [tenantId, journalId]
  );

  for (const line of lines) {
    const insertRows: Array<{ id: string }> = await manager.query(
      `
      INSERT INTO ledger_journal_lines (
        id, tenant_id, journal_id, account, side, amount_minor, currency,
        idempotency_key, correlation_id, reverses_line_id, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
      RETURNING id
      `,
      [
        line.id,
        line.tenantId,
        line.journalId,
        line.account,
        line.side,
        line.amount_minor,
        line.currency,
        line.idempotencyKey,
        line.correlationId,
        line.reversesLineId ?? null,
        line.metadata ?? null,
        line.createdAt
      ]
    );

    if (!Array.isArray(insertRows) || insertRows.length === 0) {
      continue;
    }

    anyLineInserted = true;
    const delta = signedDeltaMinor(line.side, line.amount_minor);

    await manager.query(
      `
      INSERT INTO account_balances (tenant_id, account, balance_minor, currency, row_version, updated_at)
      VALUES ($1, $2, $3::bigint, $4, 1, now())
      ON CONFLICT (tenant_id, account, currency) DO UPDATE SET
        balance_minor = account_balances.balance_minor + EXCLUDED.balance_minor,
        row_version = account_balances.row_version + 1,
        updated_at = now()
      `,
      [line.tenantId, line.account, delta, line.currency]
    );
  }

  return { journalId: result.journalId, lines, anyLineInserted };
}
