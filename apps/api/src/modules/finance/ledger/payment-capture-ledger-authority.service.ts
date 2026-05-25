import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { OutboxService } from "../../outbox/outbox.service";
import type { PaymentEntity } from "../../payments/entities/payment.entity";
import { bookingWalletId } from "./booking-ledger-authority.service";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { paymentAmountToLedgerMinorString } from "./payment-amount-to-ledger-minor";
import type { LedgerJournalLine } from "./ledger-journal-line";
import { postAndPersistDoubleEntryJournal } from "./post-double-entry-journal";
import { stablePaymentCaptureLedgerIdentifiers } from "./stable-payment-capture-ledger-ids";

export type PaymentCaptureLedgerSource = "manual_receipt_approve" | "online_webhook_paid";

/**
 * Emits the canonical payment-capture journal when a {@link PaymentEntity} reaches `Paid`.
 * Uses the same stable ids / `domainEventId` as refund reversal anchors (idempotent via outbox).
 *
 * **Strict mode (Phase 2.6):** {@link postAndPersistDoubleEntryJournal} → {@link persistLedgerJournal}
 * enforces the ledger contract before SQL. On failure throws `BadRequestException` with
 * `LEDGER_CONTRACT_VALIDATION_FAILED`, aborting the caller transaction (e.g. webhook paid transition).
 */
@Injectable()
export class PaymentCaptureLedgerAuthorityService {
  constructor(@Inject(OutboxService) private readonly outboxService: OutboxService) {}

  async emitPaymentCaptureAtPaid(
    manager: EntityManager,
    payment: Pick<PaymentEntity, "id" | "tenantId" | "registrationId" | "amount" | "currency" | "paidAt">,
    source: PaymentCaptureLedgerSource
  ): Promise<{ journalId: string; lines: [LedgerJournalLine, LedgerJournalLine] }> {
    const tenantId = payment.tenantId.trim();
    const amountMinor = paymentAmountToLedgerMinorString(String(payment.amount));
    const paidAtIso = payment.paidAt ? payment.paidAt.toISOString() : new Date().toISOString();
    const stableIds = stablePaymentCaptureLedgerIdentifiers(payment.id);

    const { journalId, lines } = await postAndPersistDoubleEntryJournal(manager, {
      tenantId,
      debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
      creditAccount: bookingWalletId(payment.registrationId),
      amount_minor: amountMinor,
      currency: payment.currency.trim().toUpperCase(),
      correlationId: `payment:${payment.id}:capture`,
      idempotencyKey: `payment:${payment.id}:capture-anchor`,
      stableJournalAndLineIds: stableIds,
      journalLinesCreatedAtIso: paidAtIso,
      metadata: {
        kind: "payment_capture_at_paid",
        source,
        paymentId: payment.id,
        registrationId: payment.registrationId
      }
    });

    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      manager,
      outboxService: this.outboxService,
      tenantId,
      registrationId: payment.registrationId,
      lines,
      domainEventIdOverride: `payment:${payment.id}:ledger-capture-anchor`
    });
    return { journalId, lines };
  }
}
