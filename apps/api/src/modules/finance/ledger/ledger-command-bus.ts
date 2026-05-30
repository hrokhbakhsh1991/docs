import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
  BookingLedgerAuthorityService,
  bookingWalletId,
} from "./booking-ledger-authority.service";
import type {
  BookingLedgerLeaderRegistrationRow,
  LeaderRegistrationPaymentPatchPayload,
} from "./contracts/leader-registration-payment-ledger.contracts";
import { normalizeFinanceTenantId } from "./ledger-tenant-scope";
import { sumWalletBalanceFromLedgerLines } from "./wallet-projection";
import type { LedgerJournalLine } from "./ledger-journal-line";

export type RecordRegistrationCreatedInput = {
  tenantId: string;
  registrationId: string;
  quotedTotalMinor: string | null;
  currency: string;
};

export type RecordBookingFinalizedInput = {
  tenantId: string;
  registrationId: string;
  quotedTotalMinor: string | null;
  currency: string;
};

/**
 * Finance-internal command surface for ledger mutations triggered by registration domain events.
 * Registrations MUST NOT import this type — handlers live in finance listeners only.
 */
@Injectable()
export class LedgerCommandBus {
  constructor(private readonly bookingLedgerAuthority: BookingLedgerAuthorityService) {}

  async lockBookingWalletAccount(
    manager: EntityManager,
    tenantId: string,
    registrationId: string,
    currency: string
  ): Promise<string> {
    const tenantNorm = normalizeFinanceTenantId(tenantId);
    const walletAccount = bookingWalletId(registrationId);
    const currencyNorm = currency.trim() || "UNK";

    await manager.query(
      `
      INSERT INTO account_balances (tenant_id, account, currency, balance_minor, row_version, updated_at)
      VALUES ($1, $2, $3, 0, 0, now())
      ON CONFLICT (tenant_id, account, currency) DO NOTHING
      `,
      [tenantNorm, walletAccount, currencyNorm]
    );

    await manager.query(
      `
      SELECT balance_minor
      FROM account_balances
      WHERE tenant_id = $1 AND account = $2 AND currency = $3
      FOR UPDATE
      `,
      [tenantNorm, walletAccount, currencyNorm]
    );

    return walletAccount;
  }

  async applyLeaderRegistrationPaymentMutation(
    manager: EntityManager,
    registration: BookingLedgerLeaderRegistrationRow,
    payload: LeaderRegistrationPaymentPatchPayload,
    idempotencyKey: string
  ): Promise<{ ledgerFacts: LedgerJournalLine[]; ledgerCorrelationId: string }> {
    return this.bookingLedgerAuthority.applyLeaderRegistrationPaymentMutation(
      manager,
      registration,
      payload,
      idempotencyKey
    );
  }

  /** Locks the booking wallet account row; monetary journals follow payment / capture events. */
  async recordRegistrationCreated(
    manager: EntityManager,
    input: RecordRegistrationCreatedInput
  ): Promise<void> {
    await this.lockBookingWalletAccount(
      manager,
      input.tenantId,
      input.registrationId,
      input.currency
    );
  }

  /** Locks wallet and verifies append-only ledger projection for the booking wallet. */
  async recordBookingFinalized(
    manager: EntityManager,
    input: RecordBookingFinalizedInput
  ): Promise<void> {
    const tenantNorm = normalizeFinanceTenantId(input.tenantId);
    const currency = input.currency.trim() || "UNK";
    const walletAccount = await this.lockBookingWalletAccount(
      manager,
      tenantNorm,
      input.registrationId,
      currency
    );

    const rows: Array<{
      id: string;
      tenantId: string;
      journalId: string;
      account: string;
      side: "debit" | "credit";
      amount_minor: string;
      currency: string;
      correlationId: string;
      idempotencyKey: string;
      createdAt: string | Date;
      reversesLineId?: string | null;
      metadata?: Record<string, unknown> | null;
    }> = await manager.query(
      `
      SELECT
        id,
        tenant_id AS "tenantId",
        journal_id AS "journalId",
        account,
        side,
        amount_minor AS "amount_minor",
        currency,
        correlation_id AS "correlationId",
        idempotency_key AS "idempotencyKey",
        created_at AS "createdAt",
        reverses_line_id AS "reversesLineId",
        metadata
      FROM ledger_journal_lines
      WHERE tenant_id = $1 AND account = $2
      ORDER BY created_at ASC, id ASC
      `,
      [tenantNorm, walletAccount]
    );

    const lines = rows.map((row) => ({
      id: row.id,
      journalId: row.journalId,
      tenantId: row.tenantId,
      account: row.account,
      side: row.side,
      amount_minor: row.amount_minor,
      currency: row.currency,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      createdAt:
        typeof row.createdAt === "string"
          ? row.createdAt
          : row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
      ...(row.reversesLineId ? { reversesLineId: row.reversesLineId } : {}),
      ...(row.metadata ? { metadata: row.metadata } : {}),
    })) as LedgerJournalLine[];

    sumWalletBalanceFromLedgerLines(tenantNorm, walletAccount, lines);
  }
}
