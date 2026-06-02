import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../../outbox/outbox.service";
import type { PaymentEntity } from "../../../payments/entities/payment.entity";
import { bookingWalletId } from "../booking-ledger-authority.service";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "../emit-finance-ledger-journal-outbox";
import { LEDGER_ACCOUNTS } from "../ledger-accounts";
import { paymentAmountToLedgerMinorString } from "../payment-amount-to-ledger-minor";
import type { LedgerJournalLine } from "../ledger-journal-line";
import {
  postAndPersistDoubleEntryJournal,
  postAndPersistDoubleEntryReversalJournal,
} from "../post-double-entry-journal";
import { stablePaymentCaptureLedgerIdentifiers } from "../stable-payment-capture-ledger-ids";
import { findDebitCreditPairForJournal } from "./ledger-journal-lines.repository";

/**
 * **Refund money path:** emits a new balanced journal that **reverses** the synthetic payment-capture
 * anchor (clearing ↔ booking wallet), with `reversesLineId` on each reversal leg pointing at the
 * original capture line. Never mutates historical `payments.amount` / `paid_at` / `provider_payment_id`.
 */
@Injectable()
export class PaymentRefundLedgerAuthorityService {
  constructor(private readonly outboxService: OutboxService) {}

  async emitPaymentRefundLedgerReversal(
    manager: EntityManager,
    payment: Pick<
      PaymentEntity,
      "id" | "tenantId" | "registrationId" | "amount" | "currency" | "paidAt" | "ledgerJournalId"
    >,
    _idempotencyKey?: string
  ): Promise<void> {
    const tenantId = payment.tenantId.trim();
    const reversalIdempotencyKey = `payment:${payment.id}:refund-reversal-anchor`;
    const stableIds = stablePaymentCaptureLedgerIdentifiers(payment.id);
    const amountMinor = paymentAmountToLedgerMinorString(String(payment.amount));
    const paidAtIso = payment.paidAt ? payment.paidAt.toISOString() : new Date().toISOString();

    let captureAnchor: [LedgerJournalLine, LedgerJournalLine];

    const persistedJournalId = payment.ledgerJournalId?.trim();
    if (persistedJournalId) {
      captureAnchor = await findDebitCreditPairForJournal(manager, tenantId, persistedJournalId);
    } else {
      const { lines } = await postAndPersistDoubleEntryJournal(manager, {
        tenantId,
        debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
        creditAccount: bookingWalletId(payment.registrationId),
        amount_minor: amountMinor,
        currency: payment.currency.trim().toUpperCase(),
        correlationId: `payment:${payment.id}:capture-anchor`,
        idempotencyKey: `payment:${payment.id}:capture-anchor`,
        stableJournalAndLineIds: stableIds,
        journalLinesCreatedAtIso: paidAtIso,
        metadata: {
          kind: "payment_capture_synthetic_anchor",
          paymentId: payment.id,
          registrationId: payment.registrationId,
        },
      });
      captureAnchor = lines;

      await emitFinanceLedgerDoubleEntryAppliedOutbox({
        manager,
        outboxService: this.outboxService,
        tenantId,
        registrationId: payment.registrationId,
        lines: captureAnchor,
        domainEventIdOverride: `payment:${payment.id}:ledger-capture-anchor`,
      });
    }

    const { lines: reversal } = await postAndPersistDoubleEntryReversalJournal(manager, {
      tenantId,
      originalLines: captureAnchor,
      correlationId: `payment:${payment.id}:refund`,
      idempotencyKey: reversalIdempotencyKey,
      metadata: {
        kind: "payment_refund_reversal",
        paymentId: payment.id,
        registrationId: payment.registrationId,
      },
    });

    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      manager,
      outboxService: this.outboxService,
      tenantId,
      registrationId: payment.registrationId,
      lines: reversal,
    });
  }
}
