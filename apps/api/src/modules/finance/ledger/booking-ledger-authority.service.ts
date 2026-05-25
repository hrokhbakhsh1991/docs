import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../outbox/outbox.service";
import type {
  BookingLedgerLeaderRegistrationRow,
  LeaderRegistrationPaymentPatchPayload
} from "./contracts/leader-registration-payment-ledger.contracts";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import type { LedgerJournalLine } from "./ledger-journal-line";
import { postAndPersistDoubleEntryJournal } from "./post-double-entry-journal";

/** Wallet id for booking / registration monetary projection (not a persisted wallet row yet). */
export function bookingWalletId(registrationId: string): string {
  return `booking:${registrationId}`;
}

/** Leader PATCH paid amount — positive integer only; no float coercion. */
export function positiveIntegerMinorStringFromLeaderAmount(amount: number): string {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("LEDGER_LEADER_PAID_AMOUNT: must be a positive integer minor amount");
  }
  return BigInt(amount).toString();
}

function paidAmountPayloadPositiveMinor(
  paidAmount: number | string | undefined
): string | null {
  if (paidAmount === undefined) {
    return null;
  }
  if (typeof paidAmount === "string") {
    const t = paidAmount.trim();
    if (!/^\d+$/.test(t)) {
      return null;
    }
    const n = BigInt(t);
    return n > 0n ? t : null;
  }
  if (!Number.isFinite(paidAmount) || !Number.isInteger(paidAmount) || paidAmount <= 0) {
    return null;
  }
  return BigInt(paidAmount).toString();
}

function isPaidAmountCleared(paidAmount: number | string | undefined): boolean {
  if (paidAmount === undefined) {
    return false;
  }
  if (typeof paidAmount === "string") {
    const t = paidAmount.trim();
    if (t === "" || t === "0") {
      return true;
    }
    if (!/^\d+$/.test(t)) {
      return false;
    }
    return BigInt(t) <= 0n;
  }
  return paidAmount <= 0;
}

function parsePreviousPaidMinor(previous: string | undefined): bigint {
  if (previous === undefined || previous.trim() === "") {
    return 0n;
  }
  const t = previous.trim();
  if (!/^\d+$/.test(t)) {
    return 0n;
  }
  return BigInt(t);
}

function projectPaidAmountString(
  registrationId: string,
  payload: LeaderRegistrationPaymentPatchPayload,
  lines: LedgerJournalLine[],
  previousPaidAmount: string | undefined
): string | undefined {
  const bookingAcct = bookingWalletId(registrationId);
  if (lines.length > 0) {
    const onBooking = lines.filter((l) => l.account === bookingAcct).sort((a, b) => {
      const c = a.createdAt.localeCompare(b.createdAt);
      return c !== 0 ? c : a.id.localeCompare(b.id);
    });
    const last = onBooking[onBooking.length - 1];
    if (last?.side === "credit") {
      return last.amount_minor;
    }
    if (last?.side === "debit") {
      return undefined;
    }
  }
  const clearing =
    payload.paymentStatus === "NotPaid" || isPaidAmountCleared(payload.paidAmount);
  if (clearing && parsePreviousPaidMinor(previousPaidAmount) === 0n) {
    return undefined;
  }
  const minor = paidAmountPayloadPositiveMinor(payload.paidAmount);
  if (minor !== null) {
    return minor;
  }
  return previousPaidAmount;
}

/**
 * **System of record (money):** append-only {@link postDoubleEntryJournal} journals (two lines each).
 * **`registrations.paid_amount`** is a **projection** derived from those facts in-process until a
 * durable `ledger_journal_lines` rows and `account_balances` snapshots on the same `EntityManager`.
 *
 * Every journal batch is also written to the **transactional outbox** on the same `EntityManager`
 * as the caller’s domain transaction (`finance.ledger.double_entry_applied`).
 *
 * No other service should assign `registration.paidAmount` — CI enforces this (`check-ledger-only-money.mjs`).
 *
 * **Strict ledger (Phase 2.6):** {@link postAndPersistDoubleEntryJournal} rejects invalid journals with
 * `LEDGER_CONTRACT_VALIDATION_FAILED` before any `ledger_journal_lines` insert — leader PATCH and
 * payment flows must treat this as a hard failure (transaction rollback).
 */
@Injectable()
export class BookingLedgerAuthorityService {
  constructor(private readonly outboxService: OutboxService) {}

  /**
   * Derives `registrations.paid_amount` from ledger lines (shared by leader PATCH and payment capture).
   */
  projectPaidAmountFromLedgerLines(
    registrationId: string,
    payload: LeaderRegistrationPaymentPatchPayload,
    lines: readonly LedgerJournalLine[],
    previousPaidAmount?: string | null
  ): string | undefined {
    return projectPaidAmountString(
      registrationId,
      payload,
      [...lines],
      previousPaidAmount ?? undefined
    );
  }

  /** Assigns `paidAmount` on a registration row from ledger facts (payment capture / receipt approve). */
  applyPaidAmountProjectionToRegistration(
    registration: BookingLedgerLeaderRegistrationRow,
    payload: LeaderRegistrationPaymentPatchPayload,
    lines: readonly LedgerJournalLine[]
  ): void {
    registration.paidAmount = projectPaidAmountString(
      registration.id,
      payload,
      [...lines],
      registration.paidAmount
    );
  }

  /**
   * Mutates `registration.paymentStatus` and `registration.paidAmount` **only** after emitting
   * balanced ledger journals and enqueueing the finance outbox event on `manager`.
   */
  async applyLeaderRegistrationPaymentMutation(
    manager: EntityManager,
    registration: BookingLedgerLeaderRegistrationRow,
    payload: LeaderRegistrationPaymentPatchPayload,
    idempotencyKey: string
  ): Promise<{ ledgerFacts: LedgerJournalLine[]; ledgerCorrelationId: string }> {
    const bookingAccount = bookingWalletId(registration.id);
    const correlationBase = `registration:${registration.id}:leader_payment`;
    const currency = registration.quotedCurrencyCode?.trim() || "UNK";
    const previousPaid = registration.paidAmount;
    const ledgerFacts: LedgerJournalLine[] = [];

    const receiveMinor = paidAmountPayloadPositiveMinor(payload.paidAmount);
    if (receiveMinor !== null) {
      const { lines } = await postAndPersistDoubleEntryJournal(manager, {
        tenantId: registration.tenantId,
        debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
        creditAccount: bookingAccount,
        amount_minor: receiveMinor,
        currency,
        correlationId: `${correlationBase}:${idempotencyKey}`,
        idempotencyKey: `${idempotencyKey}:receive`,
        metadata: {
          source: "leader_patch_registration_payment",
          paymentStatus: payload.paymentStatus,
          kind: "registration_prepayment_received"
        }
      });
      ledgerFacts.push(...lines);
    } else if (payload.paymentStatus === "NotPaid" || isPaidAmountCleared(payload.paidAmount)) {
      const prevMinor = parsePreviousPaidMinor(previousPaid);
      if (prevMinor > 0n) {
        const { lines } = await postAndPersistDoubleEntryJournal(manager, {
          tenantId: registration.tenantId,
          debitAccount: bookingAccount,
          creditAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
          amount_minor: prevMinor.toString(),
          currency,
          correlationId: `${correlationBase}:clear:${idempotencyKey}`,
          idempotencyKey: `${idempotencyKey}:clear`,
          metadata: {
            source: "leader_patch_registration_payment",
            paymentStatus: payload.paymentStatus,
            kind: "registration_prepayment_cleared"
          }
        });
        ledgerFacts.push(...lines);
      }
    }

    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      manager,
      outboxService: this.outboxService,
      tenantId: registration.tenantId,
      registrationId: registration.id,
      lines: ledgerFacts
    });

    registration.paymentStatus = payload.paymentStatus;
    registration.paidAmount = projectPaidAmountString(
      registration.id,
      payload,
      ledgerFacts,
      previousPaid
    );

    return { ledgerFacts, ledgerCorrelationId: correlationBase };
  }
}
