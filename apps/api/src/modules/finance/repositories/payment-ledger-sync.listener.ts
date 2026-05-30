import { Injectable, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { PaymentCaptureLedgerAuthorityService } from "../ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "../ledger/repositories/payment-refund-ledger-authority.service";
import { PaymentStatus } from "../../payments/domain/payment.types";

@Injectable()
export class PaymentLedgerSyncListener {
  private readonly logger = new Logger(PaymentLedgerSyncListener.name);

  constructor(
    private readonly paymentCaptureLedgerAuthority: PaymentCaptureLedgerAuthorityService,
    private readonly paymentRefundLedgerAuthority: PaymentRefundLedgerAuthorityService
  ) {}

  async handle(manager: EntityManager, _tenantId: string, payload: Record<string, unknown>): Promise<void> {
    const paymentId = payload.entityId as string;
    const newStatus = payload.newStatus as string;
    
    if (!paymentId) return;

    if (newStatus !== PaymentStatus.PAID && newStatus !== PaymentStatus.REFUNDED) {
      return;
    }

    try {
      const [paymentRow] = await manager.query(
        `SELECT id, tenant_id AS "tenantId", registration_id AS "registrationId", amount, currency, paid_at AS "paidAt", refunded_at AS "refundedAt" FROM payments WHERE id = $1`,
        [paymentId]
      );

      if (!paymentRow) {
        this.logger.warn(`Payment ${paymentId} not found for ledger sync`);
        return;
      }

      if (newStatus === PaymentStatus.PAID) {
        await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
          manager,
          {
            id: paymentRow.id,
            tenantId: paymentRow.tenantId,
            registrationId: paymentRow.registrationId,
            amount: paymentRow.amount,
            currency: paymentRow.currency,
            paidAt: paymentRow.paidAt ? new Date(paymentRow.paidAt) : new Date(),
          },
          "online_webhook_paid"
        );
        this.logger.log(`Payment capture ledger synced for ${paymentId}`);
      } else if (newStatus === PaymentStatus.REFUNDED) {
        const key = `payment-refund:${paymentRow.id}:${paymentRow.tenantId}`;
        await this.paymentRefundLedgerAuthority.emitPaymentRefundLedgerReversal(
          manager,
          {
            id: paymentRow.id,
            tenantId: paymentRow.tenantId,
            registrationId: paymentRow.registrationId,
            amount: paymentRow.amount,
            currency: paymentRow.currency,
            refundedAt: paymentRow.refundedAt ? new Date(paymentRow.refundedAt) : new Date(),
          } as any,
          key
        );
        this.logger.log(`Payment refund ledger synced for ${paymentId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync ledger for payment ${paymentId}`, error);
      throw error;
    }
  }
}