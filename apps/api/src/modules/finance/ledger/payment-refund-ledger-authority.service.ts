import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../outbox/outbox.service";
import type { PaymentEntity } from "../../payments/entities/payment.entity";
import { bookingWalletId } from "./booking-ledger-authority.service";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { paymentAmountToLedgerMinorString } from "./payment-amount-to-ledger-minor";
import { postDoubleEntryJournal, postDoubleEntryReversalJournal } from "./post-double-entry-journal";
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
    payment: Pick<PaymentEntity, "id" | "tenantId" | "registrationId" | "amount" | "currency" | "paidAt">,
    idempotencyKey: string
  ): Promise<void> {
    const trimmedKey = idempotencyKey.trim();
    if (trimmedKey === "") {
      throw new Error("PAYMENT_REFUND_LEDGER_IDEM: idempotencyKey is required for refund ledger reversal");
    }
    const tenantId = payment.tenantId.trim();
    const stableIds = stablePaymentCaptureLedgerIdentifiers(payment.id);
    const amountMinor = paymentAmountToLedgerMinorString(String(payment.amount));
    const paidAtIso = payment.paidAt ? payment.paidAt.toISOString() : new Date().toISOString();

    const { lines: captureAnchor } = postDoubleEntryJournal({
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

    const { lines: reversal } = postDoubleEntryReversalJournal({
      tenantId,
      originalLines: captureAnchor,
      correlationId: `payment:${payment.id}:refund`,
      idempotencyKey: `${trimmedKey}:payment-refund:${payment.id}`,
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
      lines: captureAnchor,
      domainEventIdOverride: `payment:${payment.id}:ledger-capture-anchor`
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
