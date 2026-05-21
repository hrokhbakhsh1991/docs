import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../outbox/outbox.service";
import type { PaymentEntity } from "../../payments/entities/payment.entity";
import { bookingWalletId } from "./booking-ledger-authority.service";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { paymentAmountToLedgerMinorString } from "./payment-amount-to-ledger-minor";
import { LedgerJournalLineEntity } from "./entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "./ledger-journal-line.mapper";
import type { LedgerJournalLine } from "./ledger-journal-line";
import {
  postAndPersistDoubleEntryJournal,
  postAndPersistDoubleEntryReversalJournal
} from "./post-double-entry-journal";
import { stablePaymentCaptureLedgerIdentifiers } from "./stable-payment-capture-ledger-ids";

/**
 * **Refund money path:** emits a new balanced journal that **reverses** the synthetic payment-capture
 * anchor (clearing ↔ booking wallet), with `reversesLineId` on each reversal leg pointing at the
 * original capture line. Never mutates historical `payments.amount` / `paid_at` / `provider_payment_id`.
 *
 * The synthetic anchor reproduces the same account mapping as checkout capture and leader prepayment
 * (`REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT` × `booking:{registrationId}`) so wallet projections net to zero after refund.
 *
 * **Two outbox rows:** (1) deterministic synthetic capture anchor (`domainEventIdOverride` per payment),
 * (2) reversal journal. When capture-at-`Paid` ledger rows exist in production, replace the synthetic
 * anchor with persisted originals so anchors are not double-posted.
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
    /** Stable anchor — idempotent replay neutralizes double-refund / double-click. */
    const reversalIdempotencyKey = `payment:${payment.id}:refund-reversal-anchor`;
    const stableIds = stablePaymentCaptureLedgerIdentifiers(payment.id);
    const amountMinor = paymentAmountToLedgerMinorString(String(payment.amount));
    const paidAtIso = payment.paidAt ? payment.paidAt.toISOString() : new Date().toISOString();

    let captureAnchor: [LedgerJournalLine, LedgerJournalLine];

    const persistedJournalId = payment.ledgerJournalId?.trim();
    if (persistedJournalId) {
      const rows = await manager.find(LedgerJournalLineEntity, {
        where: { tenantId, journalId: persistedJournalId },
        order: { side: "ASC", id: "ASC" }
      });
      const debit = rows.find((r) => r.side === "debit");
      const credit = rows.find((r) => r.side === "credit");
      if (!debit || !credit) {
        throw new Error(
          `PAYMENT_REFUND_LEDGER_ANCHOR_MISSING: journal ${persistedJournalId} has no debit/credit pair`
        );
      }
      captureAnchor = [
        ledgerJournalLineEntityToDomain(debit),
        ledgerJournalLineEntityToDomain(credit)
      ];
    } else {
      const { lines } = await postAndPersistDoubleEntryJournal(manager, {
        tenantId,
        debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
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
          registrationId: payment.registrationId
        }
      });
      captureAnchor = lines;

      await emitFinanceLedgerDoubleEntryAppliedOutbox({
        manager,
        outboxService: this.outboxService,
        tenantId,
        registrationId: payment.registrationId,
        lines: captureAnchor,
        domainEventIdOverride: `payment:${payment.id}:ledger-capture-anchor`
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
        registrationId: payment.registrationId
      }
    });

    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      manager,
      outboxService: this.outboxService,
      tenantId,
      registrationId: payment.registrationId,
      lines: reversal
    });
  }
}
